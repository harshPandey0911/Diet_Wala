/**
 * Test orders for the restaurant 7879363299 so its Orders screen shows something in the
 * "New", "Preparing" and "Ready" tabs. Orders belong to the customer 7879363299 and to the
 * restaurant's own test dishes (run scripts/seed_demo_user_7879363299.js first).
 *
 * They carry the same marker as the customer demo data, so
 * `node scripts/remove_demo_user_7879363299.js` removes them too.
 *
 * Usage: node scripts/seed_demo_restaurant_orders_7879363299.js   (safe to re-run)
 * Note: the "New" order is created "now", so the restaurant app will ring for it (the app
 * only alerts for new orders younger than 15 minutes).
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { FoodUser } from '../src/core/users/user.model.js';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodItem } from '../src/modules/food/admin/models/food.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const PHONE = '7879363299';
const DEMO = 'demo-seed-7879363299';

const minutesAgo = (n) => new Date(Date.now() - n * 60000);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const user = await FoodUser.findOne({ phone: new RegExp(`${PHONE}$`) });
  const restaurant = await FoodRestaurant.findOne({ ownerPhone: PHONE });
  if (!user || !restaurant) throw new Error('Customer or restaurant 7879363299 not found');

  const dishes = await FoodItem.find({ restaurantId: restaurant._id, approvalStatus: 'approved' }).lean();
  const byName = Object.fromEntries(dishes.map((d) => [d.name, d]));
  const need = ['Grilled Chicken Rice Bowl', 'Banana Protein Shake', 'Fish Rice Bowl', 'Fresh Fruit Salad Bowl', 'Cold Coffee', 'Energy Bite Box'];
  const missing = need.filter((n) => !byName[n]);
  if (missing.length) throw new Error(`Demo dishes missing (${missing.join(', ')}). Run scripts/seed_demo_user_7879363299.js first.`);

  const base = await db.collection('food_orders').findOne({ userId: user._id });
  if (!base) throw new Error('No existing order to copy the structure from');
  const { _id: _omit, transactionId: _tx, ...template } = base;

  const ORDERS = [
    // New orders (waiting for the restaurant to accept)
    { code: 'FOD-3076341', status: 'created', placedMinutesAgo: 1, items: [['Chicken Rice with Salad', 2], ['Cold Coffee', 2]], note: 'Less spicy please' },
    { code: 'FOD-3076877', status: 'created', placedMinutesAgo: 3, items: [['Banana Protein Shake', 2], ['Energy Bite Box', 1]], note: '' },
    // Being prepared / ready for pickup
    { code: 'FOD-3074518', status: 'preparing', placedMinutesAgo: 20, items: [['Grilled Chicken Rice Bowl', 2], ['Banana Protein Shake', 1]], note: '' },
    { code: 'FOD-3074902', status: 'preparing', placedMinutesAgo: 14, items: [['Fish Rice Bowl', 1], ['Cold Coffee', 1]], note: '' },
    { code: 'FOD-3075226', status: 'ready_for_pickup', placedMinutesAgo: 26, items: [['Fresh Fruit Salad Bowl', 1], ['Energy Bite Box', 1]], note: '' },
  ];

  for (const o of ORDERS) {
    const items = o.items.map(([name, qty]) => {
      const d = byName[name];
      return {
        itemId: String(d._id), name: d.name, variantId: '', variantName: '', variantPrice: d.price, price: d.price,
        quantity: qty, isVeg: d.foodType === 'Veg', image: d.image, notes: '',
      };
    });
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const deliveryFee = 20;
    const tax = Math.round(subtotal * 0.05 + deliveryFee * 0.18);
    const total = subtotal + deliveryFee + tax;
    const createdAt = minutesAgo(o.placedMinutesAgo);
    const history = [{ at: createdAt, byRole: 'USER', from: '', to: 'created', note: '' }];
    if (o.status !== 'created') {
      history.push({ at: new Date(createdAt.getTime() + 2 * 60000), byRole: 'RESTAURANT', from: 'created', to: 'preparing', note: '' });
    }
    if (o.status === 'ready_for_pickup') {
      history.push({ at: new Date(createdAt.getTime() + 15 * 60000), byRole: 'RESTAURANT', from: 'preparing', to: 'ready_for_pickup', note: '' });
    }

    const doc = {
      ...template,
      restaurantId: restaurant._id,
      zoneId: restaurant.zoneId || template.zoneId,
      items,
      restaurantNote: o.note,
      note: o.note,
      pricing: { ...template.pricing, subtotal, tax, deliveryFee, discount: 0, total, paymentGatewayFee: 0, tcs: 0 },
      payment: { ...template.payment, method: 'cash', status: 'cod_pending', amountDue: total },
      orderStatus: o.status,
      dispatch: { ...template.dispatch, status: 'unassigned', deliveryPartnerId: null },
      statusHistory: history,
      deliveryState: { ...template.deliveryState, currentPhase: 'en_route_to_pickup', status: '', deliveredAt: null },
      order_id: o.code,
      orderId: o.code,
      createdAt,
      updatedAt: new Date(),
      demoSeed: DEMO,
    };
    await db.collection('food_orders').updateOne({ orderId: o.code }, { $set: doc }, { upsert: true });
    console.log(`  ${o.code}: ${o.status} | ${items.map((i) => `${i.quantity}x ${i.name}`).join(', ')} | ₹${total}`);
  }

  console.log(`\nOrders ready for restaurant ${restaurant.restaurantName}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});
