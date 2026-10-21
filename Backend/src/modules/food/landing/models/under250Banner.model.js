import mongoose from 'mongoose';

const foodUnder250BannerSchema = new mongoose.Schema(
    {
        imageUrl: {
            type: String,
            required: true
        },
        publicId: {
            type: String,
            required: false,
            default: null
        },
        title: {
            type: String
        },
        ctaText: {
            type: String
        },
        ctaLink: {
            type: String
        },
        zoneId: {
            type: String
        },
        // Where the banner is shown: the phone app, the website (desktop), or both. Older banners have no value.
        bannerType: {
            type: String,
            enum: ['app', 'web', 'all'],
            default: 'app'
        },
        sortOrder: {
            type: Number,
            default: 0,
            index: true
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        }
    },
    {
        collection: 'food_under250_banners',
        timestamps: true
    }
);

foodUnder250BannerSchema.index({ isActive: 1, sortOrder: 1 });

export const FoodUnder250Banner = mongoose.model('FoodUnder250Banner', foodUnder250BannerSchema);

