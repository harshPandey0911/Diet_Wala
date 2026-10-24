import { FoodWebsiteContent, FoodWebsiteEnquiry } from '../models/website.model.js';
import { WEBSITE_DEFAULTS } from '../websiteDefaults.js';
import { ValidationError } from '../../../../core/auth/errors.js';

const MAX_TEXT = 2000;
const MAX_ITEMS = 30;
const MAX_DEPTH = 6;
const KEY_PATTERN = /^[A-Za-z0-9_]{1,40}$/;
const URL_KEY_PATTERN = /(href|url|image|logo|avatar|instagram|facebook|youtube)$/i;

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

// Links and picture addresses typed in the admin panel end up in href/src on the public site, so only
// harmless schemes are accepted (no javascript:, data: ...).
const isSafeUrl = (value) => {
    if (value === '') return true;
    if (value.startsWith('#')) return true;
    if (value.startsWith('/') && !value.startsWith('//')) return true;
    return /^(https?:\/\/|mailto:|tel:)/i.test(value);
};

const clean = (value, key, depth) => {
    if (depth > MAX_DEPTH) return undefined;
    if (typeof value === 'string') {
        const text = value.replace(/\u0000/g, '').trim().slice(0, MAX_TEXT);
        if (URL_KEY_PATTERN.test(key || '') && !isSafeUrl(text)) {
            throw new ValidationError(`Invalid link/picture address in "${key}"`);
        }
        return text;
    }
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
        return value
            .slice(0, MAX_ITEMS)
            .map((item) => clean(item, key, depth + 1))
            .filter((item) => item !== undefined);
    }
    if (isPlainObject(value)) {
        const out = {};
        for (const [childKey, childValue] of Object.entries(value)) {
            if (!KEY_PATTERN.test(childKey)) continue;
            const cleaned = clean(childValue, childKey, depth + 1);
            if (cleaned !== undefined) out[childKey] = cleaned;
        }
        return out;
    }
    return undefined;
};

// Stored values win; anything the admin never touched comes from the defaults. Lists are replaced as a whole.
const merge = (base, override) => {
    if (!isPlainObject(base) || !isPlainObject(override)) return override === undefined ? base : override;
    const out = { ...base };
    for (const [key, value] of Object.entries(override)) {
        out[key] = isPlainObject(base[key]) && isPlainObject(value) ? merge(base[key], value) : value;
    }
    return out;
};

export const getWebsiteContent = async () => {
    const doc = await FoodWebsiteContent.findOne({ key: 'main' }).lean();
    return merge(WEBSITE_DEFAULTS, doc?.content || {});
};

export const saveWebsiteContent = async (payload) => {
    if (!isPlainObject(payload)) throw new ValidationError('Invalid website content');
    const content = clean(payload, '', 0);
    await FoodWebsiteContent.findOneAndUpdate(
        { key: 'main' },
        { $set: { content } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return getWebsiteContent();
};

export const getWebsiteDefaults = () => WEBSITE_DEFAULTS;

// ----- Messages sent through the contact form of the public website -----
const text = (value, max) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);

export const createEnquiry = async ({ name, phone, message }, meta = {}) => {
    const cleanName = text(name, 100);
    const cleanPhone = text(phone, 20);
    const cleanMessage = text(message, 1500);
    if (cleanName.length < 2) throw new ValidationError('Please enter your name');
    if (!/^[0-9+\-\s()]{8,20}$/.test(cleanPhone)) throw new ValidationError('Please enter a valid phone number');
    if (cleanMessage.length < 2) throw new ValidationError('Please write your message');
    const doc = await FoodWebsiteEnquiry.create({
        name: cleanName,
        phone: cleanPhone,
        message: cleanMessage,
        ip: text(meta.ip, 64)
    });
    return { id: String(doc._id) };
};

export const listEnquiries = async () => FoodWebsiteEnquiry.find().sort({ createdAt: -1 }).limit(300).lean();
export const countNewEnquiries = async () => FoodWebsiteEnquiry.countDocuments({ status: 'new' });

export const setEnquiryStatus = async (id, status) => {
    if (!['new', 'read'].includes(status)) throw new ValidationError('Invalid status');
    return FoodWebsiteEnquiry.findByIdAndUpdate(id, { status }, { new: true }).lean();
};

export const deleteEnquiry = async (id) => {
    const res = await FoodWebsiteEnquiry.findByIdAndDelete(id);
    return { deleted: Boolean(res) };
};
