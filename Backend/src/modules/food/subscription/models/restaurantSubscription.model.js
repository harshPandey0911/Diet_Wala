import mongoose from 'mongoose';

/**
 * One document per plan assignment. The latest assignment for a restaurant has
 * `isCurrent: true`; older ones are kept as history.
 * Package details are copied in so later package edits don't change past records.
 */
const restaurantSubscriptionSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, index: true },
        zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodZone', default: null, index: true },
        packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodSubscriptionPackage', required: true },
        packageName: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 },
        durationDays: { type: Number, required: true, min: 1 },
        maxFoods: { type: Number, default: 0 },
        maxOrders: { type: Number, default: 0 },
        commissionRate: { type: Number, default: 0 },
        features: { type: [String], default: [] },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true, index: true },
        // replaced = superseded by a newer assignment
        status: {
            type: String,
            enum: ['active', 'inactive', 'expired', 'replaced'],
            default: 'active',
            index: true
        },
        isCurrent: { type: Boolean, default: true, index: true },
        notes: { type: String, trim: true, default: '' },
        assignedBy: { type: mongoose.Schema.Types.ObjectId, default: null }
    },
    { collection: 'food_restaurant_subscriptions', timestamps: true }
);

restaurantSubscriptionSchema.index({ restaurantId: 1, isCurrent: 1 });

export const FoodRestaurantSubscription = mongoose.model('FoodRestaurantSubscription', restaurantSubscriptionSchema);
