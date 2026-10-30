import { FoodBusinessSettings } from '../models/businessSettings.model.js';
import { FoodZone } from '../models/zone.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

// Platform-wide "is the app open" status. The admin can switch the whole app off by hand
// (maintenanceMode) and/or set daily opening/closing hours (IST). Customers see a
// "app is closed, opens at ..." screen and cannot order while it is closed.

const DEFAULT_OPENING = '08:00';
const DEFAULT_CLOSING = '23:00';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isValidAppTime = (value) => TIME_RE.test(String(value || '').trim());

const toMinutes = (value) => {
    const m = TIME_RE.exec(String(value || '').trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const getIstMinutes = (date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    return hour * 60 + minute;
};

export const formatAppTimeLabel = (value) => {
    const mins = toMinutes(value);
    if (mins === null) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

// Opening is inclusive, closing is exclusive. Overnight windows (close <= open) are supported.
const isWithinHours = (nowMin, openMin, closeMin) => {
    if (openMin === closeMin) return true;
    if (openMin < closeMin) return nowMin >= openMin && nowMin < closeMin;
    return nowMin >= openMin || nowMin < closeMin;
};

export function getAppAvailability(settings, now = new Date()) {
    const timingEnabled = settings?.appTimingEnabled === true;
    const opening = isValidAppTime(settings?.appOpeningTime) ? settings.appOpeningTime : DEFAULT_OPENING;
    const closing = isValidAppTime(settings?.appClosingTime) ? settings.appClosingTime : DEFAULT_CLOSING;
    const openingLabel = formatAppTimeLabel(opening);
    const closingLabel = formatAppTimeLabel(closing);
    const custom = String(settings?.appClosedMessage || '').trim();

    const base = {
        timingEnabled,
        openingTime: opening,
        closingTime: closing,
        openingLabel,
        closingLabel
    };

    if (settings?.maintenanceMode) {
        return {
            ...base,
            isOpen: false,
            reason: 'manual',
            title: 'App is closed right now',
            message: custom || (timingEnabled
                ? `Our app is currently closed. It will open at ${openingLabel}.`
                : 'Our app is currently closed. Please check back soon.')
        };
    }

    if (timingEnabled) {
        const nowMin = getIstMinutes(now);
        if (!isWithinHours(nowMin, toMinutes(opening), toMinutes(closing))) {
            const afterClosing = nowMin >= toMinutes(closing) && toMinutes(opening) < toMinutes(closing);
            return {
                ...base,
                isOpen: false,
                reason: 'timing',
                title: 'App is closed right now',
                message: custom || (afterClosing
                    ? `Our app is closed for today. It will open tomorrow at ${openingLabel}.`
                    : `Our app is closed right now. It will open at ${openingLabel}.`)
            };
        }
    }

    return { ...base, isOpen: true, reason: null, title: '', message: '' };
}

export const ZONE_APP_FIELDS = 'name appManualOff appTimingEnabled appOpeningTime appClosingTime appClosedMessage orderingPaused orderingPausedMessage';

const DEFAULT_ORDERING_PAUSED_MESSAGE =
    'Ordering is temporarily paused in your area. You can browse the menu, but orders cannot be placed right now.';

// Browse-only mode for a zone: everything stays visible, only placing orders is blocked.
export function getZoneOrderingStatus(zone) {
    const paused = zone?.orderingPaused === true;
    return {
        paused,
        message: paused ? String(zone?.orderingPausedMessage || '').trim() || DEFAULT_ORDERING_PAUSED_MESSAGE : ''
    };
}
const SETTINGS_APP_FIELDS = 'maintenanceMode appTimingEnabled appOpeningTime appClosingTime appClosedMessage';

// A zone keeps its own manual OFF switch (appManualOff) and daily hours, same shape as the global ones.
export function getZoneAppAvailability(zone, now = new Date()) {
    if (!zone) return getAppAvailability({}, now);
    return getAppAvailability(
        {
            maintenanceMode: zone.appManualOff === true,
            appTimingEnabled: zone.appTimingEnabled,
            appOpeningTime: zone.appOpeningTime,
            appClosingTime: zone.appClosingTime,
            appClosedMessage: zone.appClosedMessage
        },
        now
    );
}

// Closed if the platform-wide switch/hours say so, otherwise whatever the customer's zone says.
export function getEffectiveAppAvailability(settings, zone, now = new Date()) {
    const global = getAppAvailability(settings, now);
    if (!global.isOpen) return { ...global, scope: 'global' };
    const zoneStatus = getZoneAppAvailability(zone, now);
    return { ...zoneStatus, scope: zoneStatus.isOpen ? null : 'zone' };
}

// The platform-wide closure keeps its existing exemption for the Indore zone; a zone's own
// closure always applies to that zone.
export async function loadEffectiveAppAvailability(zoneId) {
    const settings = await FoodBusinessSettings.findOne().select(SETTINGS_APP_FIELDS).lean();
    const zone = zoneId ? await FoodZone.findById(zoneId).select(ZONE_APP_FIELDS).lean() : null;
    let availability = getEffectiveAppAvailability(settings, zone);
    if (!availability.isOpen && availability.scope === "global" && String(zone?.name || "").toLowerCase() === "indore") {
        availability = getZoneAppAvailability(zone);
    }
    return { settings, zone, availability };
}

// Throws when the app is closed for this zone.
export async function assertAppOpenForZone(zoneId) {
    const { availability } = await loadEffectiveAppAvailability(zoneId);
    if (availability.isOpen) return;
    throw new ValidationError(availability.message || "The app is closed right now. Please try again later.");
}

// Throws when ordering is paused for this zone (checked when an order is placed, not when browsing or pricing a cart).
export async function assertOrderingAllowedForZone(zoneId) {
    if (!zoneId) return;
    const zone = await FoodZone.findById(zoneId).select('name orderingPaused orderingPausedMessage').lean();
    const ordering = getZoneOrderingStatus(zone);
    if (ordering.paused) throw new ValidationError(ordering.message);
}
