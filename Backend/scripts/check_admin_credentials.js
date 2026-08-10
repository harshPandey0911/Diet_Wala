import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tuggo_food';

async function checkAndSeedAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);

    const db = mongoose.connection.db;
    const collection = db.collection('food_admins');

    const admins = await collection.find({}).toArray();
    console.log(`Found ${admins.length} admin(s) in DB:`);
    admins.forEach(a => console.log(` - Email: ${a.email}, Name: ${a.name}, Role: ${a.role || a.adminRole}`));

    // Ensure default Super Admin exists with known password
    const defaultEmail = 'admin@fudron.com';
    let defaultAdmin = await collection.findOne({ email: defaultEmail });

    const hashedPassword = await bcrypt.hash('admin123', 10);

    if (!defaultAdmin) {
      console.log(`Creating default admin: ${defaultEmail} / admin123`);
      await collection.insertOne({
        name: 'Super Admin',
        email: defaultEmail,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Default admin created successfully!');
    } else {
      console.log(`Updating password for ${defaultEmail} to: admin123`);
      await collection.updateOne(
        { email: defaultEmail },
        { $set: { password: hashedPassword, role: 'SUPER_ADMIN', isActive: true } }
      );
      console.log('Default admin password updated to admin123!');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error checking/seeding admin:', error);
    process.exit(1);
  }
}

checkAndSeedAdmin();
