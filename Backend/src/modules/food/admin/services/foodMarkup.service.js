import { FoodFeeSettings } from '../models/feeSettings.model.js';
import { invalidateCache } from '../../../../middleware/cache.js';

/**
 * Global food markup: an admin-set percentage added once to the restaurant's own price
 * wherever a customer sees a food price (public menu, food listing, search, offers).
 * Checkout does NOT add it again - it uses the already-marked-up price the customer saw.
 * Restaurant/admin management views must NOT use this; they show the restaurant's own price.
 * Cached briefly to avoid a DB round trip per item.
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

/**
 * Drop the cached multiplier and every cached public response that contains food prices,
 * so a just-saved markup shows the same price everywhere immediately.
 */
export function clearFoodMarkupCache() {
    cache = { multiplier: 1, expiresAt: 0 };
    ['foods', 'restaurants', 'restaurant_detail', 'restaurant_menu', 'restaurant', 'offers'].forEach((prefix) => {
        invalidateCache(`${prefix}:*`).catch(() => {});
    });
}

export function applyFoodMarkup(price, multiplier) {
    const base = Number(price) || 0;
    return Math.round(base * multiplier);
}
