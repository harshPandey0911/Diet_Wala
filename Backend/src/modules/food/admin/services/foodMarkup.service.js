import { FoodFeeSettings } from '../models/feeSettings.model.js';

/**
 * Global hidden food markup: an admin-set percentage baked into every food item's
 * price wherever it's shown to a customer (public menu, public food listing, and
 * order pricing). Restaurant/admin management views must NOT use this — they show
 * the restaurant's own entered price. Cached briefly to avoid a DB round trip per item.
 */
let cache = { multiplier: 1, expiresAt: 0 };
const CACHE_TTL_MS = 30 * 1000;

export async function getFoodMarkupMultiplier() {
    const now = Date.now();
    if (cache.expiresAt > now) return cache.multiplier;

    const feeSettings = await FoodFeeSettings.findOne({ isActive: true })
        .sort({ createdAt: -1 })
        .select('foodMarkupPercent')
        .lean();

    const percent = (feeSettings?.foodMarkupPercent != null && Number.isFinite(Number(feeSettings.foodMarkupPercent)))
        ? Number(feeSettings.foodMarkupPercent)
        : 0;

    cache = { multiplier: 1 + (percent / 100), expiresAt: now + CACHE_TTL_MS };
    return cache.multiplier;
}

/** Drop the cached multiplier so a just-saved markup applies immediately. */
export function clearFoodMarkupCache() {
    cache = { multiplier: 1, expiresAt: 0 };
}

export function applyFoodMarkup(price, multiplier) {
    const base = Number(price) || 0;
    return Math.round(base * multiplier);
}
