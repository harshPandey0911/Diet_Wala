import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { FoodAdmin } from '../../core/admin/admin.model.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harshpandey09112004_db_user:RQz3mzvRBroXFhe6@dietwala.tyfgjf6.mongodb.net/DietWala?appName=DietWala';

async function seedAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully.');

    const email = 'admin@admin.com';
    const rawPassword = 'admin123';

    // Delete any old admin record to clear double-hashed passwords
    await FoodAdmin.deleteMany({ email });

    // Create fresh admin record — pre('save') hook will hash rawPassword once
    const admin = new FoodAdmin({
      email,
      password: rawPassword,
      visiblePassword: rawPassword,
      name: 'Super Admin',
      phone: '9999999999',
      role: 'SUPER_ADMIN',
      isActive: true,
      servicesAccess: ['food', 'quickCommerce', 'taxi'],
      accessibleModules: ['*']
    });

    await admin.save();
    console.log(`✅ Admin account reset & created successfully!`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${rawPassword}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding Admin account:', error);
    process.exit(1);
  }
}

seedAdmin();
