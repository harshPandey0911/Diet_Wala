import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodZone } from '../src/modules/food/admin/models/zone.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const phone = '7879363299';

async function seedRestaurant() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('No MONGODB_URI found in .env');
        process.exit(1);
    }
    await mongoose.connect(mongoUri);

    let restaurant = await FoodRestaurant.findOne({
        $or: [{ ownerPhone: phone }, { ownerPhoneLast10: phone }, { primaryContactNumber: phone }],
    });

    if (restaurant) {
        console.log(`Restaurant with phone ${phone} already exists (ID: ${restaurant._id}). Marking approved & available...`);
        restaurant.status = 'approved';
        restaurant.isAvailable = true;
        await restaurant.save();
    } else {
        const zone = await FoodZone.findOne({ isActive: true }).lean();
        restaurant = await FoodRestaurant.create({
            restaurantName: 'Diet Cafe 7879363299',
            ownerName: 'Restaurant 7879363299',
            ownerEmail: 'restaurant7879363299@dietwala.com',
            ownerPhone: phone,
            primaryContactNumber: phone,
            pureVegRestaurant: false,
            status: 'approved',
            isAvailable: true,
            zoneId: zone?._id,
            addressLine1: 'Indore',
            city: 'Indore',
            state: 'Madhya Pradesh',
            location: {
                type: 'Point',
                coordinates: [75.8577, 22.7196],
                address: 'Indore, Madhya Pradesh',
                formattedAddress: 'Indore, Madhya Pradesh',
                city: 'Indore',
                state: 'Madhya Pradesh',
            },
        });
        console.log(`Created Restaurant ID: ${restaurant._id} (zone: ${zone?.name || 'none'})`);
    }

    console.log(`Phone: ${restaurant.ownerPhone} | Name: ${restaurant.restaurantName} | Status: ${restaurant.status}`);
    await mongoose.disconnect();
}

seedRestaurant().catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
});
