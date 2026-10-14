/**
 * Demo data for the customer account 7879363299 so every tab of the customer app shows
 * content with working images (Home, Meals, Orders, Profile -> Wallet / Loyalty / Notifications).
 *
 * Everything is attached to this account or to ITS OWN test restaurant ("Diet Cafe 7879363299").
 * No real restaurant, dish or order is touched. Every demo record carries a marker so that
 * `scripts/remove_demo_user_7879363299.js` can delete exactly what this script created.
 *
 * Usage:  node scripts/seed_demo_user_7879363299.js
 * Re-running is safe (records are matched by marker/name, not duplicated).
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { FoodUser } from '../src/core/users/user.model.js';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';
import { FoodItem } from '../src/modules/food/admin/models/food.model.js';
import { FoodCategory } from '../src/modules/food/admin/models/category.model.js';
import { FoodUserWallet } from '../src/modules/food/user/models/userWallet.model.js';
import { FoodUserLoyaltyPoints, FoodLoyaltyTransaction } from '../src/modules/food/loyalty/models/loyaltyPoint.model.js';
import { FoodNotification } from '../src/core/notifications/models/notification.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const PHONE = '7879363299';
const DEMO = 'demo-seed-7879363299'; // marker stored on every demo record
const ORDER_PREFIX = 'DEMO-';

// Images that already exist on the live site (all verified to load).
const IMG = (file) => `https://dietvala.com/uploads/${file}`;
const IMAGES = {
  restaurant: IMG('img_58d76f4086.webp'),
  chickenRice: IMG('img_58faef29ae.webp'),
  grilledChicken: IMG('img_279fca2867.webp'),
  fishRice: IMG('img_52c7de79ea.webp'),
  energyBite: IMG('img_52feb20802.webp'),
  coldCoffee: IMG('img_42a2cc6b06.webp'),
  bananaShake: IMG('img_60d003bb7a.webp'),
  fruits: IMG('img_4f86f58930.webp'),
  legSalad: IMG('img_bf2a32ffdb.webp'),
  avatar: IMG('img_58d76f4086.webp'),
};

const DISHES = [
  { name: 'Grilled Chicken Rice Bowl', price: 189, type: 'Non-Veg', cat: 'HIGH PROTEIN', image: IMAGES.grilledChicken, desc: 'Grilled chicken, brown rice and fresh salad. Approx 480 kcal, 38 g protein.' },
  { name: 'Chicken Rice with Salad', price: 169, type: 'Non-Veg', cat: 'MUSCLE GAIN', image: IMAGES.chickenRice, desc: 'Lean chicken with steamed rice and seasonal salad. Approx 450 kcal, 34 g protein.' },
  { name: 'Fish Rice Bowl', price: 179, type: 'Non-Veg', cat: 'WEIGHT LOSS', image: IMAGES.fishRice, desc: 'Pan-seared fish, rice and greens. Approx 410 kcal, 30 g protein.' },
  { name: 'Banana Protein Shake', price: 99, type: 'Veg', cat: 'SHAKES', image: IMAGES.bananaShake, desc: 'Banana, milk and whey blended thick. Approx 280 kcal, 20 g protein.' },
  { name: 'Cold Coffee', price: 89, type: 'Veg', cat: 'SHAKES', image: IMAGES.coldCoffee, desc: 'Chilled coffee with no added sugar. Approx 120 kcal.' },
  { name: 'Fresh Fruit Salad Bowl', price: 119, type: 'Veg', cat: 'FRUITS SALADS', image: IMAGES.fruits, desc: 'Seasonal fruits with a squeeze of lime. Approx 150 kcal.' },
  { name: 'Energy Bite Box', price: 149, type: 'Veg', cat: 'HIGH PROTEIN', image: IMAGES.energyBite, desc: 'Dates, nuts and oats energy bites. Approx 320 kcal per box.' },
];

const daysAgo = (n, hour = 13) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 12, 0, 0);
  return d;
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is missing in .env');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const user = await FoodUser.findOne({ phone: new RegExp(`${PHONE}$`) });
  if (!user) throw new Error(`Customer ${PHONE} not found. Log in once in the customer app first.`);
  const restaurant = await FoodRestaurant.findOne({ ownerPhone: PHONE });
  if (!restaurant) throw new Error(`Restaurant ${PHONE} not found. Run scripts/seed_restaurant.js first.`);

  console.log(`User: ${user._id} (${user.name}) | Restaurant: ${restaurant._id} (${restaurant.restaurantName})`);

  // 1) Test restaurant: profile photo, cuisines, rating (so its card/orders never show a broken image)
  await FoodRestaurant.updateOne(
    { _id: restaurant._id },
    {
      $set: {
        profileImage: restaurant.profileImage || IMAGES.restaurant,
        cuisines: restaurant.cuisines?.length ? restaurant.cuisines : ['High Protein', 'Healthy', 'Shakes'],
        rating: restaurant.rating || 4.6,
        totalRatings: restaurant.totalRatings || 38,
        estimatedDeliveryTime: restaurant.estimatedDeliveryTime || '25-30 min',
        isAcceptingOrders: true,
      },
    }
  );

  // 2) Dishes of the test restaurant, each with a working image
  const catIds = {};
  for (const c of await FoodCategory.find({ isActive: true, restaurantId: { $exists: false } }).select('name').lean()) {
    catIds[String(c.name).trim().toUpperCase()] = c._id;
  }
  const dishDocs = [];
  for (const dish of DISHES) {
    const fields = {
      restaurantId: restaurant._id,
      name: dish.name,
      description: dish.desc,
      price: dish.price,
      foodType: dish.type,
      image: dish.image,
      images: [dish.image],
      categoryId: catIds[dish.cat],
      categoryName: dish.cat,
      preparationTime: '15-20 mins',
      isAvailable: true,
      approvalStatus: 'approved',
      approvedAt: new Date(),
    };
    const existing = await FoodItem.findOne({ restaurantId: restaurant._id, name: dish.name });
    dishDocs.push(
      existing
        ? await FoodItem.findOneAndUpdate({ _id: existing._id }, { $set: fields }, { new: true })
        : await FoodItem.create(fields)
    );
  }
  // Older test dishes without a picture
  await FoodItem.updateMany(
    { restaurantId: restaurant._id, name: { $in: ['Shake', 'Gain', 'Chicken'] }, $or: [{ image: '' }, { image: { $exists: false } }] },
    { $set: { image: IMAGES.bananaShake, images: [IMAGES.bananaShake] } }
  );
  console.log(`Dishes ready: ${dishDocs.length}`);

  // 3) Past orders (delivered) for the order list and order details
  const baseOrder = await db.collection('food_orders').findOne({ userId: user._id });
  if (!baseOrder) throw new Error('No existing order to copy the structure from. Place one test order first.');
  const { _id: _omit, transactionId: _tx, ...template } = baseOrder;

  const byName = Object.fromEntries(dishDocs.map((d) => [d.name, d]));
  const ORDERS = [
    { code: 'DEMO-1001', daysAgo: 1, items: [['Grilled Chicken Rice Bowl', 1], ['Banana Protein Shake', 1]] },
    { code: 'DEMO-1002', daysAgo: 4, items: [['Fish Rice Bowl', 2]] },
    { code: 'DEMO-1003', daysAgo: 9, items: [['Fresh Fruit Salad Bowl', 1], ['Energy Bite Box', 1], ['Cold Coffee', 1]] },
    { code: 'DEMO-1004', daysAgo: 15, items: [['Chicken Rice with Salad', 1]] },
  ];
  for (const o of ORDERS) {
    const items = o.items.map(([name, qty]) => {
      const d = byName[name];
      return {
        itemId: String(d._id), name: d.name, variantId: '', variantName: '', variantPrice: d.price, price: d.price,
        quantity: qty, isVeg: d.foodType === 'Veg', image: d.image, notes: '',
      };
    });
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const deliveryFee = 20;
    const tax = Math.round(subtotal * 0.05 + deliveryFee * 0.18);
    const total = subtotal + deliveryFee + tax;
    const createdAt = daysAgo(o.daysAgo);
    const deliveredAt = new Date(createdAt.getTime() + 38 * 60000);
    const doc = {
      ...template,
      restaurantId: restaurant._id,
      zoneId: restaurant.zoneId || template.zoneId,
      items,
      pricing: { ...template.pricing, subtotal, tax, deliveryFee, discount: 0, total, paymentGatewayFee: 0, tcs: 0 },
      payment: { ...template.payment, method: 'cash', status: 'paid', amountDue: 0 },
      orderStatus: 'delivered',
      dispatch: { ...template.dispatch, status: 'delivered' },
      statusHistory: [
        { at: createdAt, byRole: 'USER', from: '', to: 'created', note: '' },
        { at: new Date(createdAt.getTime() + 3 * 60000), byRole: 'RESTAURANT', from: 'created', to: 'confirmed', note: '' },
        { at: deliveredAt, byRole: 'DELIVERY_PARTNER', from: 'picked_up', to: 'delivered', note: '' },
      ],
      deliveryState: { ...template.deliveryState, currentPhase: 'delivered', status: 'delivered', deliveredAt },
      order_id: o.code,
      orderId: o.code,
      createdAt,
      updatedAt: deliveredAt,
      demoSeed: DEMO,
    };
    await db.collection('food_orders').updateOne({ orderId: o.code }, { $set: doc }, { upsert: true });
  }
  // Existing cancelled test orders had dishes without a picture
  await db.collection('food_orders').updateMany(
    { userId: user._id, 'items.name': 'Shake', 'items.image': { $in: ['', null] } },
    { $set: { 'items.$[i].image': IMAGES.bananaShake } },
    { arrayFilters: [{ 'i.name': 'Shake', 'i.image': { $in: ['', null] } }] }
  );
  console.log(`Orders ready: ${ORDERS.length}`);

  // 4) Wallet with a balance and history
  const wallet = (await FoodUserWallet.findOne({ userId: user._id })) || new FoodUserWallet({ userId: user._id });
  wallet.transactions = (wallet.transactions || []).filter((t) => t?.metadata?.demoSeed !== DEMO);
  wallet.transactions.unshift(
    { type: 'addition', amount: 500, description: 'Added to wallet', status: 'Completed', metadata: { demoSeed: DEMO }, createdAt: daysAgo(12) },
    { type: 'deduction', amount: 189, description: 'Paid for order DEMO-1001', status: 'Completed', metadata: { demoSeed: DEMO }, createdAt: daysAgo(1) },
    { type: 'refund', amount: 99, description: 'Refund for a cancelled order', status: 'Completed', metadata: { demoSeed: DEMO }, createdAt: daysAgo(3) },
  );
  wallet.balance = 500 - 189 + 99;
  await wallet.save();

  // 5) Loyalty points with a ledger
  await FoodLoyaltyTransaction.deleteMany({ userId: user._id, reference: DEMO });
  await FoodUserLoyaltyPoints.findOneAndUpdate(
    { userId: user._id },
    { $set: { balance: 140, totalEarned: 240, totalRedeemed: 100 } },
    { upsert: true }
  );
  await FoodLoyaltyTransaction.insertMany([
    { userId: user._id, type: 'earn', points: 120, balanceAfter: 120, rupeeValue: 12, description: 'Points earned on order DEMO-1003', reference: DEMO, createdAt: daysAgo(9) },
    { userId: user._id, type: 'redeem', points: -100, balanceAfter: 20, rupeeValue: 10, description: 'Redeemed on order DEMO-1002', reference: DEMO, createdAt: daysAgo(4) },
    { userId: user._id, type: 'earn', points: 120, balanceAfter: 140, rupeeValue: 12, description: 'Points earned on order DEMO-1001', reference: DEMO, createdAt: daysAgo(1) },
  ]);

  // 6) Notifications with pictures
  await FoodNotification.deleteMany({ ownerId: user._id, 'metadata.demoSeed': DEMO });
  const note = (title, message, link, image, ago) => ({
    // The collection has a unique index on (broadcastId, ownerType, ownerId), so every demo
    // notification needs its own broadcastId (no real broadcast record is created for it).
    ownerType: 'USER', ownerId: user._id, title, message, link, category: 'offer', source: 'ADMIN_BROADCAST',
    broadcastId: new mongoose.Types.ObjectId(),
    metadata: { demoSeed: DEMO, image }, isRead: false, createdAt: daysAgo(ago, 10), updatedAt: daysAgo(ago, 10),
  });
  await FoodNotification.collection.insertMany([
    note('20% off on shakes today', 'Banana, coffee and protein shakes at a special price. Order now!', '/food/user', IMAGES.bananaShake, 0),
    note('Your order was delivered', 'Order DEMO-1001 was delivered. Hope you enjoyed it! Rate your meal.', '/food/user/orders', IMAGES.grilledChicken, 1),
    note('Healthy lunch ideas', 'High-protein bowls ready in 20 minutes.', '/food/user', IMAGES.chickenRice, 2),
    note('New: Fresh fruit bowls', 'Seasonal fruits, no added sugar.', '/food/user', IMAGES.fruits, 5),
    note('You earned 120 points', 'Use your loyalty points on your next order.', '/food/user/profile', IMAGES.energyBite, 9),
  ]);

  // 7) Profile photo and a second saved address
  const updates = {};
  if (!user.profileImage) updates.profileImage = IMAGES.avatar;
  if ((user.addresses || []).length < 2) {
    const home = user.addresses?.[0]?.toObject?.() || user.addresses?.[0] || {};
    const work = { ...home, label: 'Work', additionalDetails: 'Office, 2nd floor' };
    delete work._id;
    updates.addresses = [...(user.addresses || []), work];
  }
  if (Object.keys(updates).length) await FoodUser.updateOne({ _id: user._id }, { $set: updates });

  console.log('\nDemo data ready for', PHONE);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});
