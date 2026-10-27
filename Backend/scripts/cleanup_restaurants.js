import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tuggo_food';

async function cleanupRestaurants() {
  try {
    console.log('Connecting to MongoDB:', MONGO_URI);
    await mongoose.connect(MONGO_URI);

    const db = mongoose.connection.db;
    const collection = db.collection('food_restaurants');

    const allBefore = await collection.find({}).toArray();
    console.log('Total restaurants before cleanup:', allBefore.length);
    allBefore.forEach(r => console.log(` - ID: ${r._id}, Name: ${r.restaurantName || r.name}, OwnerPhone: ${r.ownerPhone}`));

    // Delete restaurants that are NOT Sakshi (name regex /sakshi/i or ownerPhone 8817921168)
    const result = await collection.deleteMany({
      $and: [
        { restaurantName: { $not: /sakshi/i } },
        { ownerName: { $not: /sakshi/i } },
        { ownerPhone: { $not: /8817921168/ } }
      ]
    });

    console.log(`\nDeleted ${result.deletedCount} demo/dummy restaurant(s).`);

    const remaining = await collection.find({}).toArray();
    console.log('\nRemaining restaurants count:', remaining.length);
    remaining.forEach(r => console.log(` - ID: ${r._id}, Name: ${r.restaurantName || r.name}, OwnerPhone: ${r.ownerPhone}`));

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning up restaurants:', error);
    process.exit(1);
  }
}

cleanupRestaurants();
