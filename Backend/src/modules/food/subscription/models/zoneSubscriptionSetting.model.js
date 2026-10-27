import mongoose from 'mongoose';

// Admin on/off switch for subscriptions in a zone. A zone with no document is treated as enabled.
const zoneSubscriptionSettingSchema = new mongoose.Schema(
    {
        zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodZone', required: true, unique: true },
        enabled: { type: Boolean, default: true },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, default: null }
    },
    { collection: 'food_zone_subscription_settings', timestamps: true }
);

export const FoodZoneSubscriptionSetting = mongoose.model('FoodZoneSubscriptionSetting', zoneSubscriptionSettingSchema);
