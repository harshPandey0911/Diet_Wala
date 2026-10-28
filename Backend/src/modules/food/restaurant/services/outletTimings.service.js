import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodRestaurantOutletTimings } from '../models/outletTimings.model.js';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const normalizeDay = (value) => {
    const v = String(value || '').trim();
    if (!v) return null;
    const exact = DAY_NAMES.find((d) => d.toLowerCase() === v.toLowerCase());
    if (exact) return exact;
    const abbr = v.slice(0, 3).toLowerCase();
    const match = DAY_NAMES.find((d) => d.toLowerCase().startsWith(abbr));
    return match || null;
};

const normalizeTime = (value, fallback) => {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    // Accept "HH:mm" or "H:mm"
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return fallback;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return fallback;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const defaultTimings = () =>
    DAY_NAMES.map((day) => ({
        day,
        isOpen: true,
        openingTime: '09:00',
        closingTime: '22:00'
    }));

const toClientShape = (doc) => {
    const timings = Array.isArray(doc?.timings) ? doc.timings : [];
    const map = {};
    for (const day of DAY_NAMES) {
        const found = timings.find((t) => normalizeDay(t?.day) === day);
        const isOpen = found ? found.isOpen !== false : true;
        map[day] = {
            isOpen,
            openingTime: isOpen ? normalizeTime(found?.openingTime, '09:00') : '',
            closingTime: isOpen ? normalizeTime(found?.closingTime, '22:00') : ''
        };
    }
    return map;
};

// Timings derived from the onboarding details when no explicit outlet timings were saved.
const buildTimingsFromRestaurant = ({ openDays, openingTime, closingTime } = {}) => {
    const hasOpenDays = Array.isArray(openDays) && openDays.length > 0;
    return DAY_NAMES.map((day) => {
        const abbr = day.substring(0, 3);
        const isOpen = hasOpenDays ? (openDays.includes(day) || openDays.includes(abbr)) : true;
        return {
            day,
            isOpen,
            openingTime: isOpen ? normalizeTime(openingTime, '09:00') : '',
            closingTime: isOpen ? normalizeTime(closingTime, '22:00') : ''
        };
    });
};

export async function getOutletTimingsForRestaurant(restaurantId) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    const doc = await FoodRestaurantOutletTimings.findOne({ restaurantId }).select('timings updatedAt').lean();
    if (!doc || !doc.timings || doc.timings.length === 0) {
        // Fallback to onboarding details
        const { FoodRestaurant } = await import('../models/restaurant.model.js');
        const restaurant = await FoodRestaurant.findById(restaurantId).lean();

        if (restaurant) {
            return { outletTimings: toClientShape({ timings: buildTimingsFromRestaurant(restaurant) }) };
        }

        return { outletTimings: toClientShape({ timings: defaultTimings() }) };
    }
    return { outletTimings: toClientShape(doc) };
}

const timeToMinutes = (value) => {
    const m = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Business hours are IST regardless of the server's TZ.
const getIstDayAndMinutes = (date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return { day: get('weekday'), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
};

const isOpenAt = (outletTimings, at) => {
    const { day, minutes } = getIstDayAndMinutes(at);
    const today = outletTimings?.[day];
    if (!today) return true;
    if (today.isOpen === false) return false;

    const open = timeToMinutes(today.openingTime);
    const close = timeToMinutes(today.closingTime);
    if (open === null || close === null || open === close) return true;
    if (close > open) return minutes >= open && minutes < close;
    return minutes >= open || minutes < close;
};

/**
 * Whether the restaurant's outlet timings allow an order at `at` (default: now).
 * Overnight windows (e.g. 18:00-02:00) are supported. Missing/partial timings => open.
 */
export async function isRestaurantWithinOutletTimings(restaurantId, at = new Date()) {
    const { outletTimings } = await getOutletTimingsForRestaurant(restaurantId);
    return isOpenAt(outletTimings, at);
}

const outletTimingsFor = (restaurant, docByRestaurant) => {
    const doc = docByRestaurant.get(String(restaurant._id));
    return doc?.timings?.length
        ? toClientShape(doc)
        : toClientShape({ timings: buildTimingsFromRestaurant(restaurant) });
};

const loadTimingDocs = async (restaurants) => {
    const docs = await FoodRestaurantOutletTimings.find({ restaurantId: { $in: restaurants.map((r) => r._id) } })
        .select('restaurantId timings')
        .lean();
    return new Map(docs.map((doc) => [String(doc.restaurantId), doc]));
};

/**
 * Switches off the "accepting orders" toggle of every online restaurant that is outside its
 * outlet timings. It only turns restaurants OFF; going back online is up to the restaurant,
 * during its opening hours. Returns how many restaurants were closed.
 */
export async function closeRestaurantsOutsideOutletTimings(at = new Date()) {
    const { FoodRestaurant } = await import('../models/restaurant.model.js');
    const restaurants = await FoodRestaurant.find({ status: 'approved', isAcceptingOrders: { $ne: false } })
        .select('_id openDays openingTime closingTime')
        .lean();
    if (!restaurants.length) return 0;

    const docs = await FoodRestaurantOutletTimings.find({ restaurantId: { $in: restaurants.map((r) => r._id) } })
        .select('restaurantId timings')
        .lean();
    const docByRestaurant = new Map(docs.map((doc) => [String(doc.restaurantId), doc]));

    const closedIds = restaurants
        .filter((restaurant) => {
            const doc = docByRestaurant.get(String(restaurant._id));
            const outletTimings = doc?.timings?.length
                ? toClientShape(doc)
                : toClientShape({ timings: buildTimingsFromRestaurant(restaurant) });
            return !isOpenAt(outletTimings, at);
        })
        .map((restaurant) => restaurant._id);
    if (!closedIds.length) return 0;

    const result = await FoodRestaurant.updateMany(
        { _id: { $in: closedIds }, isAcceptingOrders: { $ne: false } },
        { $set: { isAcceptingOrders: false, acceptingOrdersUpdatedAt: new Date() } }
    );
    return result.modifiedCount || 0;
}

export async function upsertOutletTimingsForRestaurant(restaurantId, outletTimings) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(String(restaurantId))) {
        throw new ValidationError('Invalid restaurant id');
    }
    if (!outletTimings || typeof outletTimings !== 'object' || Array.isArray(outletTimings)) {
        throw new ValidationError('outletTimings must be an object keyed by day name');
    }

    const timings = DAY_NAMES.map((day) => {
        const src = outletTimings[day] && typeof outletTimings[day] === 'object' ? outletTimings[day] : {};
        const isOpen = src.isOpen !== false;
        return {
            day,
            isOpen,
            openingTime: isOpen ? normalizeTime(src.openingTime, '09:00') : '',
            closingTime: isOpen ? normalizeTime(src.closingTime, '22:00') : ''
        };
    });

    const doc = await FoodRestaurantOutletTimings.findOneAndUpdate(
        { restaurantId },
        { $set: { timings } },
        { upsert: true, new: true, setDefaultsOnInsert: true, projection: 'timings updatedAt' }
    ).lean();

    return { outletTimings: toClientShape(doc) };
}
