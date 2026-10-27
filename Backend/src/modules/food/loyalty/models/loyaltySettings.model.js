import mongoose from 'mongoose';

/**
 * Admin-configurable rules for the loyalty points program.
 * Singleton-style collection (same convention as FoodReferralSettings) —
 * the active settings document is the one with isActive: true, most recent first.
 */
const loyaltySettingsSchema = new mongoose.Schema(
    {
        // How many points a customer earns per ₹1 of order subtotal.
        pointsPerRupee: { type: Number, min: 0, default: 1 },

        // Redemption value: how many points make up ₹1 of free food.
        // e.g. pointsPerRupeeRedemption = 10 means 10 points = ₹1 discount.
        pointsPerRupeeRedemption: { type: Number, min: 1, default: 10 },

        // Minimum order subtotal required for points to be earned on that order.
        minOrderValueToEarn: { type: Number, min: 0, default: 0 },

        // Minimum points balance a user must hold before they're allowed to redeem any.
        minPointsToRedeem: { type: Number, min: 0, default: 100 },

        // Maximum percentage of an order's subtotal that can be paid using points.
        maxRedeemPercentPerOrder: { type: Number, min: 0, max: 100, default: 50 },

        isActive: { type: Boolean, default: true, index: true }
    },
    { collection: 'food_loyalty_settings', timestamps: true }
);

loyaltySettingsSchema.index({ isActive: 1, createdAt: -1 });

export const FoodLoyaltySettings = mongoose.model('FoodLoyaltySettings', loyaltySettingsSchema);
