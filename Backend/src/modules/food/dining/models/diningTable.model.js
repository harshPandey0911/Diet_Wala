import mongoose from 'mongoose';

const diningTableSchema = new mongoose.Schema(
    {
        restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodRestaurant',
            required: true,
            index: true
        },
        tableNumber: {
            type: String,
            required: true,
            trim: true
        },
        capacity: {
            type: Number,
            required: true,
            min: 1
        },
        isActive: {
            type: Boolean,
            default: true
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'maintenance'],
            default: 'active'
        }
    },
    {
        collection: 'food_dining_tables',
        timestamps: true
    }
);

// Compound unique index: restaurantId + tableNumber (unique per restaurant, not globally)
diningTableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });
diningTableSchema.index({ restaurantId: 1, isActive: 1 });

export const FoodDiningTable = mongoose.model('FoodDiningTable', diningTableSchema);
