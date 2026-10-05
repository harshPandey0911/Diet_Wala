import mongoose from 'mongoose';

// Price override for one zone. Zones without an override use the package's default price.
const zonePriceSchema = new mongoose.Schema(
    {
        zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodZone', required: true },
        price: { type: Number, required: true, min: 0 }
    },
    { _id: false }
);

const subscriptionPackageSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true, default: '' },
        price: { type: Number, required: true, min: 0 },
        durationDays: { type: Number, required: true, min: 1 },
        maxFoods: { type: Number, default: 0, min: 0 },
        maxOrders: { type: Number, default: 0, min: 0 },
        commissionRate: { type: Number, default: 0, min: 0, max: 100 },
        features: { type: [String], default: [] },
        zonePrices: { type: [zonePriceSchema], default: [] },
        isActive: { type: Boolean, default: true, index: true },
        sortOrder: { type: Number, default: 0 }
    },
    { collection: 'food_subscription_packages', timestamps: true }
);

export const FoodSubscriptionPackage = mongoose.model('FoodSubscriptionPackage', subscriptionPackageSchema);
