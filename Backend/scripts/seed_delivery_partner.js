import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { FoodDeliveryPartner } from '../src/modules/food/delivery/models/deliveryPartner.model.js';
import { FoodDeliveryWallet } from '../src/modules/food/delivery/models/deliveryWallet.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const phone = '7879363299';

async function seedRider() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('No MONGODB_URI found in .env');
        process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Check if partner exists
    let partner = await FoodDeliveryPartner.findOne({ phone });

    if (partner) {
        console.log(`Delivery Partner with phone ${phone} already exists (ID: ${partner._id}). Updating to approved & online...`);
        partner.status = 'approved';
        partner.availabilityStatus = 'online';
        partner.approvedAt = partner.approvedAt || new Date();
        if (!partner.lastLocation || !partner.lastLocation.coordinates) {
            partner.lastLat = 22.7196;
            partner.lastLng = 75.8577;
            partner.lastLocation = { type: 'Point', coordinates: [75.8577, 22.7196] };
        }
        await partner.save();
    } else {
        console.log(`Creating new Delivery Partner with phone ${phone}...`);
        partner = await FoodDeliveryPartner.create({
            name: 'Rider 7879363299',
            phone: phone,
            countryCode: '+91',
            email: 'rider7879363299@dietwala.com',
            vehicleType: 'Bike',
            vehicleName: 'Honda Shine',
            vehicleNumber: 'MP-09-DW-7879',
            status: 'approved',
            approvedAt: new Date(),
            availabilityStatus: 'online',
            city: 'Indore',
            state: 'Madhya Pradesh',
            lastLat: 22.7196,
            lastLng: 75.8577,
            lastLocation: { type: 'Point', coordinates: [75.8577, 22.7196] },
            lastLocationAt: new Date(),
            rating: 4.8,
            totalRatings: 10
        });
        console.log(`Created Delivery Partner ID: ${partner._id}`);
    }

    // Ensure Wallet exists
    let wallet = await FoodDeliveryWallet.findOne({ deliveryPartnerId: partner._id });
    if (!wallet) {
        wallet = await FoodDeliveryWallet.create({
            deliveryPartnerId: partner._id,
            balance: 500,
            cashInHand: 0,
            totalEarnings: 1500,
            totalBonus: 200,
            totalSettled: 1000,
            totalDeliveries: 15
        });
        console.log(`Created Wallet for Delivery Partner with balance 500.`);
    } else {
        console.log(`Wallet already exists for Delivery Partner (Balance: ${wallet.balance}).`);
    }

    console.log('\n=============================================');
    console.log('SEEDING SUCCESSFUL!');
    console.log(`Delivery Partner Phone: ${partner.phone}`);
    console.log(`Name: ${partner.name}`);
    console.log(`Status: ${partner.status}`);
    console.log(`Availability: ${partner.availabilityStatus}`);
    console.log(`Partner ID: ${partner._id}`);
    console.log('=============================================\n');

    await mongoose.disconnect();
}

seedRider().catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
});
