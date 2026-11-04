import mongoose from 'mongoose';

const foodOfferSchema = new mongoose.Schema(
    {
        couponCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
        discountType: { type: String, enum: ['percentage', 'flat-price'], default: 'percentage', index: true },
        discountValue: { type: Number, required: true, min: 0 },
        customerScope: { type: String, enum: ['all', 'first-time', 'specific'], default: 'all', index: true },
        // Only set when customerScope === 'specific': the single user who can use this coupon.
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodUser', default: null, index: true },
        restaurantScope: { type: String, enum: ['all', 'selected'], default: 'all', index: true },
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant' },
        // Optional: restrict the discount to items of one category of the selected restaurant.
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodCategory', default: null },
        categoryName: { type: String, trim: true, default: '' },
        minOrderValue: { type: Number, default: 0, min: 0 },
        maxDiscount: { type: Number, default: null, min: 0 },
        usageLimit: { type: Number, default: null, min: 0 },
        perUserLimit: { type: Number, default: null, min: 0 },
        usedCount: { type: Number, default: 0, min: 0 },
        startDate: { type: Date },
        isFirstOrderOnly: { type: Boolean, default: false },
        endDate: { type: Date },
        status: { type: String, enum: ['active', 'paused', 'inactive'], default: 'active', index: true },
        showInCart: { type: Boolean, default: true }
    },
    { collection: 'food_offers', timestamps: true }
);

foodOfferSchema.index({ restaurantId: 1, createdAt: -1 });

export const FoodOffer = mongoose.model('FoodOffer', foodOfferSchema);
