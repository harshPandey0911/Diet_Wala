/**
 * READ-ONLY analysis of how much food markup is sitting inside historical orders.
 *
 * There is no history of the admin's markup percentage (the fee-settings doc is updated in
 * place), so instead of assuming a percentage and a start date, each order is compared
 * against the restaurant's own current menu price: for every order item we look up the food
 * item by id and work out the ratio between what the customer was charged and the
 * restaurant's own price. A ratio of ~1.20 means a 20% markup was baked in; ~1.00 means it
 * was not.
 *
 * Writes nothing. Run with:  node scripts/analyze-order-markup.mjs
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) {
    console.error('No MONGO_URI / MONGODB_URI in the environment.');
    process.exit(1);
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
const db = mongoose.connection.db;

const feeSettings = await db
    .collection('food_fee_settings')
    .find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
const currentPercent = Number(feeSettings?.[0]?.foodMarkupPercent || 0);
const currentMultiplier = 1 + currentPercent / 100;

console.log('='.repeat(72));
console.log(`Current admin food markup: ${currentPercent}%  (multiplier ${currentMultiplier})`);
console.log(
    `Fee settings last updated: ${feeSettings?.[0]?.updatedAt?.toISOString?.() || 'unknown'}`
);
console.log('='.repeat(72));

const orders = await db
    .collection('food_orders')
    .find({})
    .project({
        orderId: 1,
        restaurantId: 1,
        orderStatus: 1,
        createdAt: 1,
        items: 1,
        'pricing.subtotal': 1,
        'pricing.markupAmount': 1,
        platformProfit: 1,
    })
    .sort({ createdAt: 1 })
    .toArray();

console.log(`\nTotal orders in database: ${orders.length}`);
if (orders.length === 0) {
    await mongoose.disconnect();
    process.exit(0);
}

const alreadyTagged = orders.filter((o) => o?.pricing?.markupAmount != null);
const untagged = orders.filter((o) => o?.pricing?.markupAmount == null);
console.log(`  already carrying markupAmount : ${alreadyTagged.length}`);
console.log(`  missing markupAmount          : ${untagged.length}`);

// Pull every food item referenced by the untagged orders so prices can be compared.
const itemIds = new Set();
untagged.forEach((o) =>
    (o.items || []).forEach((i) => {
        const id = String(i?.itemId || '').trim();
        if (/^[a-f0-9]{24}$/i.test(id)) itemIds.add(id);
    })
);

const foodItems = await db
    .collection('food_items')
    .find({ _id: { $in: [...itemIds].map((id) => new mongoose.Types.ObjectId(id)) } })
    .project({ name: 1, price: 1, variants: 1 })
    .toArray();
const foodById = new Map(foodItems.map((f) => [String(f._id), f]));

console.log(`\nMenu items referenced by those orders: ${itemIds.size} (${foodItems.length} still exist)`);

/** The restaurant's own price for an order line, variant included. */
function restaurantOwnPrice(orderItem, food) {
    if (!food) return null;
    const variantId = String(orderItem?.variantId || '').trim();
    if (variantId) {
        const variant = (food.variants || []).find((v) => String(v._id) === variantId);
        if (variant) return Number(variant.price) || 0;
    }
    return Number(food.price) || 0;
}

const buckets = {
    markupMatches: [],   // order price == restaurant price x current multiplier
    noMarkup: [],        // order price == restaurant price
    unknown: [],         // price changed since, or item deleted - cannot tell
};

const perOrder = [];

for (const order of untagged) {
    const items = Array.isArray(order.items) ? order.items : [];
    let matched = 0;
    let plain = 0;
    let unknown = 0;
    let impliedMarkup = 0;

    for (const item of items) {
        const food = foodById.get(String(item?.itemId || ''));
        const ownPrice = restaurantOwnPrice(item, food);
        const paidPrice = Number(item?.price) || 0;
        const qty = Number(item?.quantity) || 1;

        if (!ownPrice || ownPrice <= 0) {
            unknown += 1;
            continue;
        }

        const expectedWithMarkup = Math.round(ownPrice * currentMultiplier);
        if (paidPrice === expectedWithMarkup && currentMultiplier > 1) {
            matched += 1;
            impliedMarkup += (paidPrice - ownPrice) * qty;
        } else if (paidPrice === Math.round(ownPrice)) {
            plain += 1;
        } else {
            unknown += 1;
        }
    }

    const verdict =
        matched > 0 && unknown === 0 && plain === 0
            ? 'markup'
            : plain > 0 && matched === 0 && unknown === 0
              ? 'no-markup'
              : 'unknown';

    // What the generic formula (strip the current % off the stored subtotal) would say.
    const subtotal = Number(order?.pricing?.subtotal || 0);
    const formulaMarkup =
        currentMultiplier > 1 ? round2(subtotal - subtotal / currentMultiplier) : 0;

    perOrder.push({
        orderId: order.orderId,
        createdAt: order.createdAt,
        status: order.orderStatus,
        subtotal,
        verdict,
        itemsMatched: matched,
        itemsPlain: plain,
        itemsUnknown: unknown,
        impliedMarkup: round2(impliedMarkup),
        formulaMarkup,
    });

    if (verdict === 'markup') buckets.markupMatches.push(order);
    else if (verdict === 'no-markup') buckets.noMarkup.push(order);
    else buckets.unknown.push(order);
}

console.log('\n' + '-'.repeat(72));
console.log('Verdict per order (by comparing against the restaurant\'s own menu price)');
console.log('-'.repeat(72));
console.log(`  markup clearly applied   : ${buckets.markupMatches.length}`);
console.log(`  no markup applied        : ${buckets.noMarkup.length}`);
console.log(`  cannot tell (price moved / item deleted) : ${buckets.unknown.length}`);

const sumImplied = round2(perOrder.reduce((s, o) => s + (o.verdict === 'markup' ? o.impliedMarkup : 0), 0));
const sumFormulaAll = round2(perOrder.reduce((s, o) => s + o.formulaMarkup, 0));
const sumFormulaMarkupOnly = round2(
    perOrder.reduce((s, o) => s + (o.verdict === 'markup' ? o.formulaMarkup : 0), 0)
);

console.log('\nMarkup money involved:');
console.log(`  from item-by-item comparison (markup orders only) : Rs ${sumImplied}`);
console.log(`  from the subtotal formula  (markup orders only)   : Rs ${sumFormulaMarkupOnly}`);
console.log(`  from the subtotal formula  (ALL untagged orders)  : Rs ${sumFormulaAll}`);
console.log(
    '\n  (The first two agreeing means the formula is safe to use for the backfill.)'
);

console.log('\n' + '-'.repeat(72));
console.log('Every untagged order');
console.log('-'.repeat(72));
console.log(
    'date        status        order            subtotal  verdict     implied  formula  items(m/p/?)'
);
perOrder.forEach((o) => {
    const date = o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : '----------';
    console.log(
        `${date}  ${String(o.status || '').padEnd(12)}  ${String(o.orderId || '').padEnd(15)}  ` +
            `${String(o.subtotal).padStart(8)}  ${o.verdict.padEnd(10)}  ` +
            `${String(o.impliedMarkup).padStart(7)}  ${String(o.formulaMarkup).padStart(7)}  ` +
            `${o.itemsMatched}/${o.itemsPlain}/${o.itemsUnknown}`
    );
});

// How much restaurant payout would move, per restaurant.
const txs = await db
    .collection('food_transactions')
    .find({ orderId: { $in: untagged.map((o) => o._id) } })
    .project({ orderId: 1, restaurantId: 1, 'amounts.restaurantShare': 1, 'amounts.platformNetProfit': 1, 'settlement.isRestaurantSettled': 1 })
    .toArray();

const orderById = new Map(untagged.map((o) => [String(o._id), o]));
const perOrderByMongoId = new Map(
    untagged.map((o, idx) => [String(o._id), perOrder[idx]])
);

const restaurants = await db
    .collection('food_restaurants')
    .find({})
    .project({ restaurantName: 1 })
    .toArray();
const restaurantNameById = new Map(restaurants.map((r) => [String(r._id), r.restaurantName]));

const byRestaurant = new Map();
let settledAffected = 0;
for (const tx of txs) {
    const analysis = perOrderByMongoId.get(String(tx.orderId));
    if (!analysis || analysis.verdict !== 'markup') continue;
    const key = String(tx.restaurantId);
    const row = byRestaurant.get(key) || {
        name: restaurantNameById.get(key) || key,
        orders: 0,
        currentShare: 0,
        overpaid: 0,
    };
    row.orders += 1;
    row.currentShare += Number(tx.amounts?.restaurantShare || 0);
    row.overpaid += analysis.formulaMarkup;
    byRestaurant.set(key, row);
    if (tx.settlement?.isRestaurantSettled) settledAffected += 1;
}

console.log('\n' + '-'.repeat(72));
console.log('Restaurant payout impact (orders where markup was clearly applied)');
console.log('-'.repeat(72));
if (byRestaurant.size === 0) {
    console.log('  Nothing to correct.');
} else {
    console.log('restaurant                     orders   current payout   overpaid   corrected');
    for (const row of byRestaurant.values()) {
        console.log(
            `${String(row.name).slice(0, 28).padEnd(30)} ${String(row.orders).padStart(6)}   ` +
                `${String(round2(row.currentShare)).padStart(14)}   ${String(round2(row.overpaid)).padStart(8)}   ` +
                `${String(round2(row.currentShare - row.overpaid)).padStart(9)}`
        );
    }
}
console.log(`\nTransactions already marked settled among these: ${settledAffected}`);
console.log(`Transactions found for untagged orders: ${txs.length} (of ${untagged.length} orders)`);

console.log('\nNothing was written. This script is read-only.\n');

await mongoose.disconnect();
