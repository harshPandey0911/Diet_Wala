/**
 * Removes exactly what scripts/seed_demo_user_7879363299.js created.
 * Usage:  node scripts/remove_demo_user_7879363299.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { FoodUser } from '../src/core/users/user.model.js';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodItem } from '../src/modules/food/admin/models/food.model.js';
import { FoodUserWallet } from '../src/modules/food/user/models/userWallet.model.js';
import { FoodUserLoyaltyPoints, FoodLoyaltyTransaction } from '../src/modules/food/loyalty/models/loyaltyPoint.model.js';
import { FoodNotification } from '../src/core/notifications/models/notification.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const PHONE = '7879363299';
const DEMO = 'demo-seed-7879363299';
const DISH_NAMES = [
  'Grilled Chicken Rice Bowl', 'Chicken Rice with Salad', 'Fish Rice Bowl', 'Banana Protein Shake',
  'Cold Coffee', 'Fresh Fruit Salad Bowl', 'Energy Bite Box',
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const user = await FoodUser.findOne({ phone: new RegExp(`${PHONE}$`) });
  const restaurant = await FoodRestaurant.findOne({ ownerPhone: PHONE });
  if (!user) throw new Error('Customer not found');

  const orders = await db.collection('food_orders').deleteMany({ userId: user._id, demoSeed: DEMO });
  const notes = await FoodNotification.deleteMany({ ownerId: user._id, 'metadata.demoSeed': DEMO });
  const ledger = await FoodLoyaltyTransaction.deleteMany({ userId: user._id, reference: DEMO });
  await FoodUserLoyaltyPoints.deleteOne({ userId: user._id });
  const wallet = await FoodUserWallet.findOne({ userId: user._id });
  if (wallet) {
    wallet.transactions = wallet.transactions.filter((t) => t?.metadata?.demoSeed !== DEMO);
    wallet.balance = 0;
    await wallet.save();
  }
  let dishes = { deletedCount: 0 };
  if (restaurant) dishes = await FoodItem.deleteMany({ restaurantId: restaurant._id, name: { $in: DISH_NAMES } });

  console.log(`Removed: orders=${orders.deletedCount}, notifications=${notes.deletedCount}, loyalty entries=${ledger.deletedCount}, dishes=${dishes.deletedCount}, wallet demo entries cleared.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Remove failed:', error.message);
  process.exit(1);
});
