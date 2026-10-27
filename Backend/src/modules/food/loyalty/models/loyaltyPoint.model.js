import mongoose from 'mongoose';

/**
 * Per-user loyalty points balance. Kept as a small, fast-to-read document —
 * the actual history lives in FoodLoyaltyTransaction (flat ledger, same
 * pattern as FoodTransaction for order finance) so the admin report can
 * query/paginate across every user without unwinding embedded arrays.
 */
const userLoyaltyPointsSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, unique: true, index: true },
        balance: { type: Number, default: 0, min: 0 },
        totalEarned: { type: Number, default: 0, min: 0 },
        totalRedeemed: { type: Number, default: 0, min: 0 }
    },
    { collection: 'food_user_loyalty_points', timestamps: true }
);

export const FoodUserLoyaltyPoints = mongoose.model('FoodUserLoyaltyPoints', userLoyaltyPointsSchema);

const loyaltyTransactionSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', required: true, index: true },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', index: true },

        type: {
            type: String,
            enum: ['earn', 'redeem', 'refund', 'admin_adjust'],
            required: true,
            index: true
        },

        // Positive for credit (earn/refund/positive admin_adjust), negative for debit (redeem).
        points: { type: Number, required: true },
        balanceAfter: { type: Number, required: true, min: 0 },

        // Rupee equivalent, informational only (redemption value at the time of this entry).
        rupeeValue: { type: Number, default: 0 },

        description: { type: String, default: '' },
        reference: { type: String, default: '' },
        metadata: { type: Object, default: {} }
    },
    { collection: 'food_loyalty_transactions', timestamps: true }
);

loyaltyTransactionSchema.index({ createdAt: -1 });

export const FoodLoyaltyTransaction = mongoose.model('FoodLoyaltyTransaction', loyaltyTransactionSchema);
