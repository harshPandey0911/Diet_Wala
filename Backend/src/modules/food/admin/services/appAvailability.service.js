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
