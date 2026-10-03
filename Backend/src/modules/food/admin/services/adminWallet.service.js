import mongoose from 'mongoose';
import { creditWallet, debitWallet, getWalletWithTransactions } from '../../../../core/payments/wallet.service.js';
import { FoodRestaurantWallet } from '../../restaurant/models/restaurantWallet.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';

const ENTITY_TYPES = ['user', 'restaurant', 'deliveryBoy'];

function assertValidEntity(entityType, entityId) {
    if (!ENTITY_TYPES.includes(entityType)) {
        throw new ValidationError(`entityType must be one of: ${ENTITY_TYPES.join(', ')}`);
    }
    if (!entityId || !mongoose.Types.ObjectId.isValid(String(entityId))) {
        throw new ValidationError('A valid entityId is required');
    }
}

/**
 * Admin manually adjusts (credits or debits) a user/restaurant/delivery-partner wallet.
 * Every adjustment is recorded through the shared Transaction ledger with a full
 * audit trail (who did it, and why) via category + metadata.
 */
export async function adminAdjustWallet({ entityType, entityId, action, amount, reason, adminId }) {
    assertValidEntity(entityType, entityId);

    if (!['credit', 'debit'].includes(action)) {
        throw new ValidationError("action must be 'credit' or 'debit'");
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new ValidationError('amount must be a positive number');
    }

    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason) {
        throw new ValidationError('A reason is required for a manual wallet adjustment');
    }

    const description = `Admin ${action === 'credit' ? 'credited' : 'debited'} wallet: ${trimmedReason}`;
    const metadata = { adjustedBy: adminId ? String(adminId) : null, reason: trimmedReason, source: 'admin_manual_adjustment' };

    const op = action === 'credit' ? creditWallet : debitWallet;
    const result = await op({
        entityType,
        entityId,
        amount: numericAmount,
        description,
        category: 'admin_adjustment',
        metadata,
    });

    return {
        entityType,
        entityId: String(entityId),
        action,
        amount: numericAmount,
        balance: result.wallet.balance,
        transactionId: String(result.transaction._id),
    };
}

/** Admin: view any entity's wallet balance + recent transactions (includes admin adjustments). */
export async function adminGetWallet(entityType, entityId, { page = 1, limit = 20 } = {}) {
    assertValidEntity(entityType, entityId);
    return getWalletWithTransactions(entityType, entityId, { page, limit });
}

/** Admin: paginated list of restaurant wallets (mirrors the existing delivery wallets view). */
export async function getRestaurantWallets({ page = 1, limit = 20, search = '' } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const restaurantFilter = {};
    const trimmedSearch = String(search || '').trim();
    if (trimmedSearch) {
        restaurantFilter.restaurantName = { $regex: trimmedSearch, $options: 'i' };
    }

    const restaurants = trimmedSearch
        ? await FoodRestaurant.find(restaurantFilter).select('_id restaurantName phone').lean()
        : null;
    const restaurantIdFilter = restaurants ? { restaurantId: { $in: restaurants.map((r) => r._id) } } : {};

    const [wallets, total] = await Promise.all([
        FoodRestaurantWallet.find(restaurantIdFilter)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        FoodRestaurantWallet.countDocuments(restaurantIdFilter),
    ]);

    const restaurantIds = wallets.map((w) => w.restaurantId).filter(Boolean);
    const restaurantDocs = restaurantIds.length
        ? await FoodRestaurant.find({ _id: { $in: restaurantIds } }).select('restaurantName phone').lean()
        : [];
    const restaurantMap = new Map(restaurantDocs.map((r) => [String(r._id), r]));

    const items = wallets.map((w) => {
        const restaurant = restaurantMap.get(String(w.restaurantId));
        return {
            restaurantId: String(w.restaurantId),
            restaurantName: restaurant?.restaurantName || 'Unknown',
            phone: restaurant?.phone || '',
            balance: Number(w.balance) || 0,
            lockedAmount: Number(w.lockedAmount) || 0,
            totalEarnings: Number(w.totalEarnings) || 0,
            totalSettled: Number(w.totalSettled) || 0,
        };
    });

    return { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
}
