/** READ-ONLY: checks the corrected numbers the way the admin dashboard and the
 *  restaurant finance page read them. */
import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
const db = mongoose.connection.db;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// --- Admin dashboard "Markup earned" (delivered orders only) ---
const dash = await db
    .collection('food_orders')
    .aggregate([
        {
            $match: {
                orderStatus: 'delivered',
                $or: [
                    { 'payment.method': { $in: ['cash', 'wallet'] } },
                    { 'payment.status': { $in: ['paid', 'authorized', 'captured', 'settled', 'refunded'] } },
                ],
            },
        },
        {
            $group: {
                _id: null,
                markupTotal: { $sum: { $ifNull: ['$pricing.markupAmount', 0] } },
                markupOrders: {
                    $sum: { $cond: [{ $gt: [{ $ifNull: ['$pricing.markupAmount', 0] }, 0] }, 1, 0] },
                },
                markupBaseTotal: {
                    $sum: {
                        $subtract: [
                            { $ifNull: ['$pricing.subtotal', 0] },
                            { $ifNull: ['$pricing.markupAmount', 0] },
                        ],
                    },
                },
                subtotalTotal: { $sum: { $ifNull: ['$pricing.subtotal', 0] } },
                adminNetProfit: { $sum: { $ifNull: ['$platformProfit', 0] } },
            },
        },
    ])
    .toArray();

const d = dash[0] || {};
console.log('ADMIN DASHBOARD - Markup earnings (delivered orders)');
console.log(`  Markup earned          : Rs ${round2(d.markupTotal)}`);
console.log(`  Orders with markup     : ${d.markupOrders || 0}`);
console.log(`  Customer item subtotal : Rs ${round2(d.subtotalTotal)}`);
console.log(`  Restaurant item value  : Rs ${round2(d.markupBaseTotal)}`);
console.log(`  Admin net profit       : Rs ${round2(d.adminNetProfit)}`);

// --- Restaurant finance "Estimated payout" per restaurant ---
const rows = await db
    .collection('food_transactions')
    .aggregate([
        { $match: { status: { $in: ['captured', 'authorized'] }, 'settlement.isRestaurantSettled': { $ne: true } } },
        { $lookup: { from: 'food_orders', localField: 'orderId', foreignField: '_id', as: 'order' } },
        { $unwind: '$order' },
        { $match: { 'order.orderStatus': 'delivered' } },
        {
            $group: {
                _id: '$restaurantId',
                payout: { $sum: { $ifNull: ['$amounts.restaurantShare', 0] } },
                markup: { $sum: { $ifNull: ['$amounts.markupAmount', 0] } },
                orders: { $sum: 1 },
            },
        },
    ])
    .toArray();

const names = new Map(
    (await db.collection('food_restaurants').find({}).project({ restaurantName: 1 }).toArray()).map(
        (r) => [String(r._id), r.restaurantName]
    )
);

console.log('\nRESTAURANT FINANCE - unsettled payout per restaurant');
let payoutSum = 0;
let markupSum = 0;
for (const row of rows) {
    payoutSum += row.payout;
    markupSum += row.markup;
    console.log(
        `  ${String(names.get(String(row._id)) || row._id).padEnd(22)} ${row.orders} orders   ` +
            `payout Rs ${round2(row.payout)}   (markup kept by admin: Rs ${round2(row.markup)})`
    );
}
console.log(`  ${''.padEnd(22)} TOTAL payout Rs ${round2(payoutSum)}, markup Rs ${round2(markupSum)}`);

await mongoose.disconnect();
