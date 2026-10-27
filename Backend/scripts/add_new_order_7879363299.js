/**
 * Adds ONE fresh "New" order (placed just now) to the restaurant 7879363299, with a realistic
 * order id, items, note and totals. Existing orders are not touched. Run it whenever the New tab
 * is empty. Same hidden marker as the other demo data, so remove_demo_user_7879363299.js
 * deletes it as well.
 *
 * Usage: node scripts/add_new_order_7879363299.js
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

const BASKETS = [
  { items: [['Grilled Chicken Rice Bowl', 1], ['Cold Coffee', 1]], note: 'Please pack the dressing separately' },
  { items: [['Chicken Rice with Salad', 1], ['Banana Protein Shake', 1]], note: '' },
  { items: [['Fish Rice Bowl', 2]], note: 'Less oil please' },
  { items: [['Fresh Fruit Salad Bowl', 2], ['Energy Bite Box', 1]], note: '' },
  { items: [['Grilled Chicken Rice Bowl', 2], ['Fresh Fruit Salad Bowl', 1]], note: 'No onions in the salad' },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const user = await FoodUser.findOne({ phone: new RegExp(`${PHONE}$`) });
  const restaurant = await FoodRestaurant.findOne({ ownerPhone: PHONE });
  if (!user || !restaurant) throw new Error('Customer or restaurant 7879363299 not found');

  const dishes = await FoodItem.find({ restaurantId: restaurant._id, approvalStatus: 'approved' }).lean();
  const byName = Object.fromEntries(dishes.map((d) => [d.name, d]));
  const basket = BASKETS[Math.floor(Math.random() * BASKETS.length)];
  if (basket.items.some(([name]) => !byName[name])) throw new Error('Test dishes missing. Run scripts/seed_demo_user_7879363299.js first.');

  const base = await db.collection('food_orders').findOne({ userId: user._id });
  const { _id: _omit, transactionId: _tx, ...template } = base;

  // Same format as real orders: FOD-<7 digits>, never reused
  let code;
  do { code = `FOD-${Math.floor(1000000 + Math.random() * 9000000)}`; } while (await db.collection('food_orders').findOne({ orderId: code }));

  const items = basket.items.map(([name, qty]) => {
    const d = byName[name];
    return { itemId: String(d._id), name: d.name, variantId: '', variantName: '', variantPrice: d.price, price: d.price, quantity: qty, isVeg: d.foodType === 'Veg', image: d.image, notes: '' };
  });
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee = 20;
  const tax = Math.round(subtotal * 0.05 + deliveryFee * 0.18);
  const total = subtotal + deliveryFee + tax;
  const createdAt = new Date();

  await db.collection('food_orders').insertOne({
    ...template,
    restaurantId: restaurant._id,
    zoneId: restaurant.zoneId || template.zoneId,
    items,
    restaurantNote: basket.note,
    note: basket.note,
    pricing: { ...template.pricing, subtotal, tax, deliveryFee, discount: 0, total, paymentGatewayFee: 0, tcs: 0 },
    payment: { ...template.payment, method: 'cash', status: 'cod_pending', amountDue: total },
    orderStatus: 'created',
    dispatch: { ...template.dispatch, status: 'unassigned', deliveryPartnerId: null },
    statusHistory: [{ at: createdAt, byRole: 'USER', from: '', to: 'created', note: '' }],
    deliveryState: { ...template.deliveryState, currentPhase: 'en_route_to_pickup', status: '', deliveredAt: null },
    order_id: code,
    orderId: code,
    createdAt,
    updatedAt: createdAt,
    demoSeed: DEMO,
  });

  console.log(`New order ${code}: ${items.map((i) => `${i.quantity}x ${i.name}`).join(', ')} | ₹${total}${basket.note ? ` | note: "${basket.note}"` : ''}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Failed:', error.message);
  process.exit(1);
});
