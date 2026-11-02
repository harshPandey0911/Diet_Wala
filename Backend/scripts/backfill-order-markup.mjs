/**
 * Corrects historical orders that were settled as if the admin's food markup belonged to
 * the restaurant.
 *
 * Background: every customer-facing food price already carries the admin's markup, so an
 * item the restaurant priced at Rs 100 reaches checkout at Rs 120 with a 20% markup. Until
 * the markup was split out, the whole Rs 120 was treated as the restaurant's item value, so
 * the restaurant was paid on it and the Rs 20 of platform margin never reached the admin.
 *
 * What this script does, per order:
 *   1. Works out the markup baked into the order. Prices are matched item by item against
 *      the restaurant's own menu price (exact, matching how the markup was applied with a
 *      per-item rounding); orders whose items can no longer be matched fall back to
 *      stripping the current percentage off the stored subtotal.
 *   2. Records it on the order and its transaction as `markupAmount` / `markupPercent`.
 *   3. Re-bases the charges that are defined as a rate on the item value (GST on item, TCS)
 *      onto the restaurant's own price instead of the marked-up one.
 *   4. Moves the markup out of the restaurant's payout and into the platform's profit.
 *
 * Payment gateway fee is charged on what the customer actually paid, so it is left alone.
 *
 * Orders that already carry `markupAmount` are skipped, so the script is safe to re-run.
 * Transactions already marked settled are NOT touched - that money has been paid out, and
 * reopening it is a decision for a human, so they are reported instead.
 *
 * Usage:
 *   node scripts/backfill-order-markup.mjs            # dry run, writes nothing
 *   node scripts/backfill-order-markup.mjs --apply    # writes, after saving a backup
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) {
    console.error('No MONGO_URI / MONGODB_URI in the environment.');
    process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
const db = mongoose.connection.db;

const feeSettings = await db
    .collection('food_fee_settings')
    .find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
const currentPercent = Number(feeSettings?.[0]?.foodMarkupPercent || 0);
const multiplier = 1 + currentPercent / 100;

console.log('='.repeat(78));
console.log(`${APPLY ? 'APPLYING' : 'DRY RUN (nothing will be written)'}`);
console.log(`Admin food markup in effect: ${currentPercent}%`);
console.log('='.repeat(78));

if (multiplier <= 1) {
    console.log('\nNo markup is configured, so there is nothing to correct.');
    await mongoose.disconnect();
    process.exit(0);
}

const orders = await db
    .collection('food_orders')
    .find({ 'pricing.markupAmount': { $exists: false } })
    .sort({ createdAt: 1 })
    .toArray();

console.log(`\nOrders without a recorded markup: ${orders.length}`);
if (orders.length === 0) {
    console.log('Nothing to do.');
    await mongoose.disconnect();
    process.exit(0);
}

// Menu prices, used to measure the markup exactly rather than assuming it.
const itemIds = new Set();
orders.forEach((o) =>
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

function restaurantOwnPrice(orderItem, food) {
    if (!food) return null;
    const variantId = String(orderItem?.variantId || '').trim();
    if (variantId) {
        const variant = (food.variants || []).find((v) => String(v._id) === variantId);
        if (variant) return Number(variant.price) || 0;
    }
    return Number(food.price) || 0;
}

/**
 * Markup inside one order. Prefers the item-by-item measurement; returns source 'formula'
 * when some line cannot be matched back to a current menu price.
 */
function measureMarkup(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const subtotal = Number(order?.pricing?.subtotal || 0);
    let total = 0;
    let allMatched = items.length > 0;

    for (const item of items) {
        const food = foodById.get(String(item?.itemId || ''));
        const ownPrice = restaurantOwnPrice(item, food);
        const paidPrice = Number(item?.price) || 0;
        const qty = Number(item?.quantity) || 1;

        if (!ownPrice || ownPrice <= 0) {
            allMatched = false;
            break;
        }
        if (paidPrice === Math.round(ownPrice * multiplier)) {
            total += (paidPrice - ownPrice) * qty;
        } else if (paidPrice === Math.round(ownPrice)) {
            // This line carried no markup.
        } else {
            allMatched = false;
            break;
        }
    }

    if (allMatched) return { markup: round2(total), source: 'items' };
    return { markup: round2(subtotal - subtotal / multiplier), source: 'formula' };
}

const planned = [];
const skippedSettled = [];
const skippedCommission = [];
const skippedNoMarkup = [];

for (const order of orders) {
    const { markup, source } = measureMarkup(order);
    if (markup <= 0) {
        skippedNoMarkup.push(order.orderId);
        continue;
    }

    const pricing = order.pricing || {};
    const subtotal = Number(pricing.subtotal || 0);
    const base = round2(subtotal - markup);

    const tx = await db.collection('food_transactions').findOne({ orderId: order._id });

    if (tx?.settlement?.isRestaurantSettled) {
        skippedSettled.push(order.orderId);
        continue;
    }

    // Commission can be a flat amount rather than a percentage, so it cannot be re-based
    // automatically. None of the affected orders should have one; if any does, report it.
    const storedCommission = Number(pricing.restaurantCommission || 0);
    if (storedCommission > 0) {
        skippedCommission.push({ orderId: order.orderId, commission: storedCommission });
        continue;
    }

    // Charges defined as a rate on the item value get re-based onto the restaurant's price.
    const rebase = (amount) => {
        const value = Number(amount || 0);
        if (value <= 0 || subtotal <= 0) return round2(value);
        return round2(value * (base / subtotal));
    };
    const newGstOnItem = rebase(pricing.gstOnItem);
    const newTcs = rebase(pricing.tcs);
    const gstOnItemDelta = round2(Number(pricing.gstOnItem || 0) - newGstOnItem);
    const tcsDelta = round2(Number(pricing.tcs || 0) - newTcs);

    const packagingFee = Number(pricing.packagingFee || 0);
    const gstOnCommission = Number(pricing.gstOnCommission || 0);
    const paymentGatewayFee = Number(pricing.paymentGatewayFee || 0);

    const oldShare = Number(tx?.amounts?.restaurantShare ?? 0);
    const newShare = round2(
        Math.max(
            0,
            base + packagingFee - storedCommission - newGstOnItem - gstOnCommission - paymentGatewayFee - newTcs
        )
    );

    const oldPlatformProfit = Number(order.platformProfit || 0);
    // The markup moves to the platform; the re-based GST/TCS move back to the restaurant.
    const profitDelta = round2(markup - gstOnItemDelta - tcsDelta);
    const newPlatformProfit = round2(oldPlatformProfit + profitDelta);

    planned.push({
        _id: order._id,
        orderId: order.orderId,
        status: order.orderStatus,
        txId: tx?._id || null,
        subtotal,
        markup,
        source,
        base,
        oldGstOnItem: Number(pricing.gstOnItem || 0),
        newGstOnItem,
        oldTcs: Number(pricing.tcs || 0),
        newTcs,
        oldShare,
        newShare,
        shareDelta: round2(newShare - oldShare),
        oldPlatformProfit,
        newPlatformProfit,
    });
}

console.log('\n' + '-'.repeat(78));
console.log('Planned corrections');
console.log('-'.repeat(78));
console.log(
    'order            status        subtotal  markup  src      payout: before -> after   (change)'
);
planned.forEach((p) => {
    console.log(
        `${String(p.orderId).padEnd(15)}  ${String(p.status).slice(0, 12).padEnd(12)}  ` +
            `${String(p.subtotal).padStart(8)}  ${String(p.markup).padStart(6)}  ${p.source.padEnd(7)}  ` +
            `${String(p.oldShare).padStart(8)} -> ${String(p.newShare).padStart(8)}   (${p.shareDelta})`
    );
});

const totalMarkup = round2(planned.reduce((s, p) => s + p.markup, 0));
const totalShareDelta = round2(planned.reduce((s, p) => s + p.shareDelta, 0));
const totalProfitDelta = round2(
    planned.reduce((s, p) => s + (p.newPlatformProfit - p.oldPlatformProfit), 0)
);

console.log('\nTotals');
console.log(`  orders corrected            : ${planned.length}`);
console.log(`  markup moved to the platform: Rs ${totalMarkup}`);
console.log(`  restaurant payout change    : Rs ${totalShareDelta}`);
console.log(`  platform profit change      : Rs ${totalProfitDelta}`);
console.log(
    `  (payout falls by the markup but rises slightly as GST/TCS are re-based onto the lower item value)`
);

if (skippedNoMarkup.length) {
    console.log(`\nSkipped - no markup found: ${skippedNoMarkup.join(', ')}`);
}
if (skippedSettled.length) {
    console.log(
        `\nSkipped - ALREADY SETTLED (needs a human decision): ${skippedSettled.join(', ')}`
    );
}
if (skippedCommission.length) {
    console.log(
        `\nSkipped - has a restaurant commission that cannot be re-based automatically:`,
        skippedCommission
    );
}

if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write these changes.\n');
    await mongoose.disconnect();
    process.exit(0);
}

// --- Backup before writing, so the change can be reversed ---
const backupDir = path.resolve('scripts/backups');
fs.mkdirSync(backupDir, { recursive: true });
const backupPath = path.join(
    backupDir,
    `markup-backfill-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
);

const backupOrders = await db
    .collection('food_orders')
    .find({ _id: { $in: planned.map((p) => p._id) } })
    .toArray();
const backupTxs = await db
    .collection('food_transactions')
    .find({ orderId: { $in: planned.map((p) => p._id) } })
    .toArray();

fs.writeFileSync(
    backupPath,
    JSON.stringify({ takenAt: new Date().toISOString(), orders: backupOrders, transactions: backupTxs }, null, 2)
);
console.log(`\nBackup of the untouched documents: ${backupPath}`);

let ordersUpdated = 0;
let txsUpdated = 0;

for (const p of planned) {
    const orderResult = await db.collection('food_orders').updateOne(
        { _id: p._id, 'pricing.markupAmount': { $exists: false } },
        {
            $set: {
                'pricing.markupAmount': p.markup,
                'pricing.markupPercent': currentPercent,
                'pricing.gstOnItem': p.newGstOnItem,
                'pricing.tcs': p.newTcs,
                platformProfit: p.newPlatformProfit,
            },
        }
    );
    ordersUpdated += orderResult.modifiedCount;

    if (p.txId) {
        const txResult = await db.collection('food_transactions').updateOne(
            { _id: p.txId, 'settlement.isRestaurantSettled': { $ne: true } },
            {
                $set: {
                    'pricing.markupAmount': p.markup,
                    'pricing.markupPercent': currentPercent,
                    'pricing.gstOnItem': p.newGstOnItem,
                    'pricing.tcs': p.newTcs,
                    'amounts.markupAmount': p.markup,
                    'amounts.gstOnItem': p.newGstOnItem,
                    'amounts.tcs': p.newTcs,
                    'amounts.restaurantShare': p.newShare,
                    'amounts.platformNetProfit': p.newPlatformProfit,
                },
                $push: {
                    history: {
                        kind: 'adjusted',
                        amount: p.markup,
                        at: new Date(),
                        note: `Food markup of Rs ${p.markup} moved from the restaurant payout to platform margin (backfill)`,
                        recordedBy: { role: 'SYSTEM' },
                    },
                },
            }
        );
        txsUpdated += txResult.modifiedCount;
    }
}

console.log(`\nOrders updated      : ${ordersUpdated}`);
console.log(`Transactions updated: ${txsUpdated}`);
console.log('\nDone.\n');

await mongoose.disconnect();
