import mongoose from 'mongoose';
import { FoodLoyaltySettings } from '../models/loyaltySettings.model.js';
import { FoodUserLoyaltyPoints, FoodLoyaltyTransaction } from '../models/loyaltyPoint.model.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { buildPaginationOptions, buildPaginatedResult } from '../../../../utils/helpers.js';

const DEFAULT_SETTINGS = {
    pointsPerRupee: 1,
    pointsPerRupeeRedemption: 10,
    minOrderValueToEarn: 0,
    minPointsToRedeem: 100,
    maxRedeemPercentPerOrder: 50,
    isActive: true
};

// ----- Admin: settings -----

export async function getLoyaltySettings() {
    const doc = await FoodLoyaltySettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
    return doc || { ...DEFAULT_SETTINGS, _id: null };
}

export async function upsertLoyaltySettings(body = {}) {
    const existing = await FoodLoyaltySettings.findOne({ isActive: true }).sort({ createdAt: -1 });
    if (existing) {
        const $set = {};
        if (body.pointsPerRupee !== undefined) $set.pointsPerRupee = Math.max(0, Number(body.pointsPerRupee) || 0);
        if (body.pointsPerRupeeRedemption !== undefined) $set.pointsPerRupeeRedemption = Math.max(1, Number(body.pointsPerRupeeRedemption) || 1);
        if (body.minOrderValueToEarn !== undefined) $set.minOrderValueToEarn = Math.max(0, Number(body.minOrderValueToEarn) || 0);
        if (body.minPointsToRedeem !== undefined) $set.minPointsToRedeem = Math.max(0, Number(body.minPointsToRedeem) || 0);
        if (body.maxRedeemPercentPerOrder !== undefined) $set.maxRedeemPercentPerOrder = Math.min(100, Math.max(0, Number(body.maxRedeemPercentPerOrder) || 0));
        if (body.isActive !== undefined) $set.isActive = Boolean(body.isActive);

        if (!Object.keys($set).length) return existing.toObject();
        return FoodLoyaltySettings.findByIdAndUpdate(existing._id, { $set }, { new: true }).lean();
    }

    const created = await FoodLoyaltySettings.create({ ...DEFAULT_SETTINGS, ...body });
    return created.toObject();
}

// ----- Internal helpers -----

async function ensureUserPoints(userId) {
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('User not found');
    }
    const oid = new mongoose.Types.ObjectId(id);
    const existing = await FoodUserLoyaltyPoints.findOne({ userId: oid });
    if (existing) return existing;
    try {
        return await FoodUserLoyaltyPoints.create({ userId: oid, balance: 0, totalEarned: 0, totalRedeemed: 0 });
    } catch (err) {
        // Race: another request created it first — fetch instead of failing.
        if (err?.code === 11000) return FoodUserLoyaltyPoints.findOne({ userId: oid });
        throw err;
    }
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ----- User: balance + history -----

export async function getUserPointsSummary(userId) {
    const settings = await getLoyaltySettings();
    const doc = await FoodUserLoyaltyPoints.findOne({ userId }).lean();
    const balance = Number(doc?.balance) || 0;
    return {
        balance,
        totalEarned: Number(doc?.totalEarned) || 0,
        totalRedeemed: Number(doc?.totalRedeemed) || 0,
        redemptionValue: round2(balance / (settings.pointsPerRupeeRedemption || 1)),
        settings: {
            pointsPerRupee: settings.pointsPerRupee,
            pointsPerRupeeRedemption: settings.pointsPerRupeeRedemption,
            minOrderValueToEarn: settings.minOrderValueToEarn,
            minPointsToRedeem: settings.minPointsToRedeem,
            maxRedeemPercentPerOrder: settings.maxRedeemPercentPerOrder,
            isActive: settings.isActive
        }
    };
}

export async function getUserPointsHistory(userId, query = {}) {
    const { page, limit, skip } = buildPaginationOptions(query);
    const filter = { userId: new mongoose.Types.ObjectId(userId) };

    const [docs, total] = await Promise.all([
        FoodLoyaltyTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        FoodLoyaltyTransaction.countDocuments(filter)
    ]);

    return buildPaginatedResult({ docs, total, page, limit });
}

// ----- Earning points (called when an order is delivered) -----

/**
 * Credits points for a completed order. Safe to call more than once for the
 * same order — the caller is expected to guard with order.loyalty.pointsCredited,
 * but this also no-ops if a ledger entry for this exact order already exists.
 */
export async function creditPointsForOrder({ userId, orderId, orderRefId, orderSubtotal }) {
    const settings = await getLoyaltySettings();
    if (!settings.isActive) return { pointsEarned: 0 };

    const subtotal = Number(orderSubtotal) || 0;
    if (subtotal <= 0 || subtotal < Number(settings.minOrderValueToEarn || 0)) {
        return { pointsEarned: 0 };
    }

    const alreadyCredited = await FoodLoyaltyTransaction.findOne({ orderId, type: 'earn' }).lean();
    if (alreadyCredited) return { pointsEarned: alreadyCredited.points };

    const pointsEarned = Math.floor(subtotal * Number(settings.pointsPerRupee || 0));
    if (pointsEarned <= 0) return { pointsEarned: 0 };

    const wallet = await ensureUserPoints(userId);
    wallet.balance = Number(wallet.balance || 0) + pointsEarned;
    wallet.totalEarned = Number(wallet.totalEarned || 0) + pointsEarned;
    await wallet.save();

    await FoodLoyaltyTransaction.create({
        userId,
        orderId,
        type: 'earn',
        points: pointsEarned,
        balanceAfter: wallet.balance,
        description: `Points earned on order #${orderRefId || orderId}`,
        reference: String(orderRefId || orderId || ''),
        metadata: { orderSubtotal: subtotal, pointsPerRupee: settings.pointsPerRupee }
    });

    return { pointsEarned, balance: wallet.balance };
}

// ----- Redeeming points (used during checkout) -----

/**
 * Works out how many points can actually be redeemed against an order, clamped
 * by the user's balance, the admin's minimum-to-redeem rule, and the
 * max-percent-of-order-value cap. Pure calculation — does not touch the ledger.
 * Used by both the checkout pricing preview and order creation, so the two
 * always agree on the same numbers.
 */
export async function computePointsRedemption(userId, orderSubtotal, requestedPoints) {
    const settings = await getLoyaltySettings();
    const requested = Math.max(0, Math.floor(Number(requestedPoints) || 0));

    const base = {
        pointsToRedeem: 0,
        discountAmount: 0,
        ratePerPoint: settings.pointsPerRupeeRedemption ? round2(1 / settings.pointsPerRupeeRedemption) : 0,
        balance: 0,
        maxRedeemablePoints: 0,
        reason: null
    };

    if (!settings.isActive || requested <= 0) return base;

    const doc = await FoodUserLoyaltyPoints.findOne({ userId }).lean();
    const balance = Number(doc?.balance) || 0;
    base.balance = balance;

    if (balance < Number(settings.minPointsToRedeem || 0)) {
        base.reason = `You need at least ${settings.minPointsToRedeem} points to redeem.`;
        return base;
    }

    const subtotal = Math.max(0, Number(orderSubtotal) || 0);
    const maxDiscountAllowed = round2((subtotal * Number(settings.maxRedeemPercentPerOrder || 0)) / 100);
    const maxPointsFromOrderCap = Math.floor(maxDiscountAllowed * Number(settings.pointsPerRupeeRedemption || 1));

    const maxRedeemablePoints = Math.max(0, Math.min(balance, maxPointsFromOrderCap));
    base.maxRedeemablePoints = maxRedeemablePoints;

    const pointsToRedeem = Math.min(requested, maxRedeemablePoints);
    base.pointsToRedeem = pointsToRedeem;
    base.discountAmount = round2(pointsToRedeem / Number(settings.pointsPerRupeeRedemption || 1));

    if (pointsToRedeem < requested) {
        base.reason = pointsToRedeem === 0
            ? 'Points cannot be redeemed on this order.'
            : `Only ${pointsToRedeem} points could be applied (order/points limit).`;
    }

    return base;
}

/**
 * Authoritative debit of points for a placed order. Recomputes the redemption
 * server-side from the current balance/settings rather than trusting the
 * amount the client displayed — mirrors how wallet payments are deducted for
 * orders (see userWalletService.deductWalletBalance).
 */
export async function redeemPointsForOrder({ userId, orderId, orderRefId, orderSubtotal, requestedPoints }) {
    const redemption = await computePointsRedemption(userId, orderSubtotal, requestedPoints);
    if (redemption.pointsToRedeem <= 0) return { pointsRedeemed: 0, discountAmount: 0 };

    const wallet = await ensureUserPoints(userId);
    if (Number(wallet.balance || 0) < redemption.pointsToRedeem) {
        throw new ValidationError('Insufficient loyalty points balance');
    }

    wallet.balance = Number(wallet.balance) - redemption.pointsToRedeem;
    wallet.totalRedeemed = Number(wallet.totalRedeemed || 0) + redemption.pointsToRedeem;
    await wallet.save();

    await FoodLoyaltyTransaction.create({
        userId,
        orderId,
        type: 'redeem',
        points: -redemption.pointsToRedeem,
        balanceAfter: wallet.balance,
        rupeeValue: redemption.discountAmount,
        description: `Points redeemed on order #${orderRefId || orderId}`,
        reference: String(orderRefId || orderId || '')
    });

    return { pointsRedeemed: redemption.pointsToRedeem, discountAmount: redemption.discountAmount };
}

/**
 * Reverses a previous redemption (e.g. order cancelled/refunded before
 * delivery). Idempotent per order — no-ops if nothing was ever redeemed or a
 * refund entry already exists for this order.
 */
export async function refundRedeemedPointsForOrder(orderId, description = 'Points refunded for cancelled order') {
    const redeemTx = await FoodLoyaltyTransaction.findOne({ orderId, type: 'redeem' }).lean();
    if (!redeemTx || redeemTx.points >= 0) return { pointsRefunded: 0 };

    const alreadyRefunded = await FoodLoyaltyTransaction.findOne({ orderId, type: 'refund' }).lean();
    if (alreadyRefunded) return { pointsRefunded: 0 };

    const pointsToRefund = Math.abs(redeemTx.points);
    const wallet = await ensureUserPoints(redeemTx.userId);
    wallet.balance = Number(wallet.balance || 0) + pointsToRefund;
    wallet.totalRedeemed = Math.max(0, Number(wallet.totalRedeemed || 0) - pointsToRefund);
    await wallet.save();

    await FoodLoyaltyTransaction.create({
        userId: redeemTx.userId,
        orderId,
        type: 'refund',
        points: pointsToRefund,
        balanceAfter: wallet.balance,
        description,
        reference: redeemTx.reference || ''
    });

    return { pointsRefunded: pointsToRefund };
}

// ----- Admin: adjustments + report -----

export async function adminAdjustUserPoints({ userId, points, description, adminId }) {
    const delta = Math.trunc(Number(points) || 0);
    if (!delta) throw new ValidationError('points must be a non-zero integer');

    const wallet = await ensureUserPoints(userId);
    if (delta < 0 && Number(wallet.balance || 0) + delta < 0) {
        throw new ValidationError('Cannot reduce points below zero');
    }

    wallet.balance = Number(wallet.balance || 0) + delta;
    if (delta > 0) wallet.totalEarned = Number(wallet.totalEarned || 0) + delta;
    else wallet.totalRedeemed = Number(wallet.totalRedeemed || 0) + Math.abs(delta);
    await wallet.save();

    await FoodLoyaltyTransaction.create({
        userId,
        type: 'admin_adjust',
        points: delta,
        balanceAfter: wallet.balance,
        description: description || 'Manual adjustment by admin',
        metadata: { adminId: String(adminId || '') }
    });

    return { balance: wallet.balance };
}

export async function getAdminLoyaltyLedger(query = {}) {
    const { page, limit, skip } = buildPaginationOptions(query);
    const filter = {};

    if (query.type) filter.type = query.type;
    if (query.startDate || query.endDate) {
        filter.createdAt = {};
        if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
        if (query.endDate) {
            const end = new Date(query.endDate);
            end.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = end;
        }
    }

    let userIds = null;
    if (query.search) {
        const users = await FoodUser.find({
            $or: [
                { name: { $regex: query.search, $options: 'i' } },
                { phone: { $regex: query.search, $options: 'i' } },
                { email: { $regex: query.search, $options: 'i' } }
            ]
        }).select('_id').lean();
        userIds = users.map((u) => u._id);
        filter.userId = { $in: userIds };
    }

    const [docs, total] = await Promise.all([
        FoodLoyaltyTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        FoodLoyaltyTransaction.countDocuments(filter)
    ]);

    const uniqueUserIds = [...new Set(docs.map((d) => String(d.userId)))];
    const users = await FoodUser.find({ _id: { $in: uniqueUserIds } }).select('name phone email').lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const data = docs.map((t) => {
        const user = userMap.get(String(t.userId));
        return {
            transactionId: String(t._id),
            customer: user?.name || user?.phone || user?.email || 'Unknown',
            credit: t.points > 0 ? t.points : 0,
            debit: t.points < 0 ? Math.abs(t.points) : 0,
            balance: t.balanceAfter,
            transactionType: t.type,
            reference: t.reference || '',
            description: t.description || '',
            createdAt: t.createdAt
        };
    });

    return buildPaginatedResult({ docs: data, total, page, limit });
}
