import mongoose from 'mongoose';

const broadcastTargetSchema = new mongoose.Schema(
    {
        ownerType: {
            type: String,
            enum: ['USER', 'RESTAURANT', 'DELIVERY_PARTNER'],
            required: true
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        label: {
            type: String,
            default: '',
            trim: true
        },
        subLabel: {
            type: String,
            default: '',
            trim: true
        }
    },
    { _id: false }
);

const notificationBroadcastSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        targetType: {
            type: String,
            enum: ['ALL', 'USER', 'RESTAURANT', 'DELIVERY', 'CUSTOM'],
            required: true,
            index: true
        },
        targetIds: {
            type: [mongoose.Schema.Types.ObjectId],
            default: []
        },
        targets: {
            type: [broadcastTargetSchema],
            default: []
        },
        link: {
            type: String,
            default: '',
            trim: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodAdmin',
            required: true,
            index: true
        },
        targetCount: {
            type: Number,
            default: 0
        },
        image: {
            type: String,
            default: '',
            trim: true
        },
        voipTokens: {
            type: [String],
            default: []
        },
        // Legacy documents have no status and were sent immediately.
        status: {
            type: String,
            enum: ['scheduled', 'sending', 'sent', 'failed'],
            default: 'sent',
            index: true
        },
        scheduledAt: {
            type: Date,
            default: null
        },
        sentAt: {
            type: Date,
            default: null
        },
        resentFrom: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        }
    },
    {
        collection: 'food_notification_broadcasts',
        timestamps: { createdAt: true, updatedAt: false }
    }
);

notificationBroadcastSchema.index({ createdAt: -1 });

export const BroadcastNotification = mongoose.model('BroadcastNotification', notificationBroadcastSchema);
