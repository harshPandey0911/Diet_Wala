import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            required: true
        },
        otp: {
            type: String,
            select: false
        },
        purpose: {
            type: String,
            enum: ['login', 'register', 'passcode_setup', 'passcode_reset'],
            default: 'login'
        },
        otpHash: {
            type: String,
            required: true,
            select: false
        },
        expiresAt: {
            type: Date,
            required: true
        },
        attempts: {
            type: Number,
            default: 0
        },
        requestCount: {
            type: Number,
            default: 1
        },
        lastRequestAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        collection: 'food_otps',
        timestamps: true
    }
);

// TTL index for automatic expiry
otpSchema.index({ phone: 1, purpose: 1 }, { unique: true });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const FoodOtp = mongoose.model('FoodOtp', otpSchema);

