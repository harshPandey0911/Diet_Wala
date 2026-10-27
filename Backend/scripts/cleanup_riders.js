import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tuggo_food';

async function cleanupRiders() {
  try {
    console.log('Connecting to MongoDB:', MONGO_URI);
    await mongoose.connect(MONGO_URI);

    const db = mongoose.connection.db;
    const collection = db.collection('food_delivery_partners');

    const allPartnersBefore = await collection.find({}).toArray();
    console.log('Total partners before cleanup:', allPartnersBefore.length);
    allPartnersBefore.forEach(p => console.log(` - ID: ${p._id}, Name: ${p.name}, Phone: ${p.phone}`));

    // Delete partners that are NOT Abhishek (name regex /abhishek/i or phone containing 8817921167)
    const result = await collection.deleteMany({
      $and: [
        { name: { $not: /abhishek/i } },
        { phone: { $not: /8817921167/ } }
      ]
    });

    console.log(`\nDeleted ${result.deletedCount} demo/dummy rider(s).`);

    const remainingPartners = await collection.find({}).toArray();
    console.log('\nRemaining partners count:', remainingPartners.length);
    remainingPartners.forEach(p => console.log(` - ID: ${p._id}, Name: ${p.name}, Phone: ${p.phone}`));

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning up riders:', error);
    process.exit(1);
  }
}

cleanupRiders();
