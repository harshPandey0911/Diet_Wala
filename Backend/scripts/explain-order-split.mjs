/**
 * READ-ONLY: works out, using the live fee settings and the real pricing/payout functions,
 * exactly what a customer pays for one food item and how that money splits between the
 * restaurant, the rider and the platform.
 *
 * Usage: node scripts/explain-order-split.mjs [restaurantPrice] [distanceKm]
 *        node scripts/explain-order-split.mjs 100 1.4
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { applyFoodMarkup, extractMarkupFromMarkedUpAmount } from '../src/modules/food/admin/services/foodMarkup.service.js';
import { computeRiderEarningFromRules } from '../src/modules/food/orders/services/riderEarning.util.js';
import { getRestaurantBaseSubtotal } from '../src/modules/food/orders/services/foodTransaction.service.js';

const RESTAURANT_PRICE = Number(process.argv[2] || 100);
const DISTANCE_KM = Number(process.argv[3] || 1.4);
const QTY = 1;

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const rs = (n) => `Rs ${r2(n).toFixed(2)}`;

await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
const db = mongoose.connection.db;

const fee = (await db.collection('food_fee_settings').find({ isActive: true }).sort({ createdAt: -1 }).limit(1).toArray())[0];
const rules = await db.collection('food_delivery_commission_rules').find({ status: { $ne: false } }).toArray();
const activeCommissionRules = await db.collection('food_restaurant_commissions').find({ status: { $ne: false } }).toArray();

const markupPercent = Number(fee.foodMarkupPercent || 0);
const multiplier = 1 + markupPercent / 100;

// ---------- 1. What the customer sees and pays (order-pricing.service.js) ----------
const shownPrice = applyFoodMarkup(RESTAURANT_PRICE, multiplier);
const subtotal = Math.round(shownPrice * QTY);

const freeUpTo = Number(fee.freeDeliveryUpTo || 0);
let deliveryFee = 0;
if (freeUpTo > 0 && subtotal >= freeUpTo) {
    deliveryFee = 0;
} else {
    const ranges = [...(fee.deliveryFeeRanges || [])].sort((a, b) => a.min - b.min);
    for (let i = 0; i < ranges.length; i += 1) {
        const isLast = i === ranges.length - 1;
        const inRange = isLast
            ? DISTANCE_KM >= ranges[i].min
            : DISTANCE_KM >= ranges[i].min && DISTANCE_KM < ranges[i].max;
        if (inRange) { deliveryFee = Number(ranges[i].fee); break; }
    }
}

const platformFee = Number(fee.platformFee || 0);
const packagingFee = Number(fee.packagingFee || 0);

const itemTax = subtotal * (Number(fee.gstRate || 0) / 100);
const deliveryTax = deliveryFee * (Number(fee.gstOnDeliveryFee || 0) / 100);
const platformTax = platformFee * (Number(fee.gstOnPlatformFee || 0) / 100);
const packagingTax = packagingFee * (Number(fee.gstOnPackagingFee || 0) / 100);
const tax = Math.round(itemTax + deliveryTax + platformTax + packagingTax);

const total = subtotal + deliveryFee + tax + platformFee + packagingFee;

// ---------- 2. The markup split (order.service.js) ----------
const markupAmount = extractMarkupFromMarkedUpAmount(subtotal, multiplier);
const pricing = { subtotal, markupAmount };
const base = getRestaurantBaseSubtotal(pricing);

// ---------- 3. What the restaurant is charged (foodTransaction.service.js) ----------
const applyTaxes = fee.applyGlobalTaxes !== false;
let commissionRate = Number(fee.globalRestaurantCommission || 0);
let commissionNote = 'global default';
if (activeCommissionRules.length) {
    commissionNote = `${activeCommissionRules.length} per-restaurant rule(s) active - varies by restaurant`;
}
const commission = r2(base * (commissionRate / 100));
const gstOnItem = applyTaxes ? r2(base * (Number(fee.globalGstOnItem || 0) / 100)) : 0;
const gstOnCommission = applyTaxes ? r2(commission * (Number(fee.globalGstOnCommission || 0) / 100)) : 0;
const paymentGatewayFee = applyTaxes ? r2(total * (Number(fee.globalPaymentGatewayFee || 0) / 100)) : 0;
const tcs = applyTaxes ? r2(base * (Number(fee.globalTcs || 0) / 100)) : 0;

const restaurantNet = r2(base + packagingFee - commission - gstOnItem - gstOnCommission - paymentGatewayFee - tcs);

// ---------- 4. Rider ----------
const riderEarning = computeRiderEarningFromRules(DISTANCE_KM, rules) + Number(fee.deliveryBonusAmount || 0);

// ---------- 5. Platform ----------
const platformProfit = r2(
    deliveryFee + platformFee + commission + gstOnItem + paymentGatewayFee + tcs + markupAmount - riderEarning
);

const line = (label, value, note = '') =>
    console.log(`  ${label.padEnd(34)} ${rs(value).padStart(11)}  ${note}`);

console.log('='.repeat(78));
console.log(`Restaurant's own price ${rs(RESTAURANT_PRICE)} | distance ${DISTANCE_KM} km | markup ${markupPercent}%`);
console.log('='.repeat(78));

console.log('\n1) WHAT THE CUSTOMER SEES AND PAYS');
line('Item price shown in the app', shownPrice, `(${rs(RESTAURANT_PRICE)} + ${markupPercent}% markup, hidden)`);
line('Item subtotal', subtotal);
line('Delivery fee', deliveryFee, DISTANCE_KM <= 3 ? '(0-3 km slab)' : '');
line('Platform fee', platformFee);
line('Packaging fee', packagingFee);
line('GST', tax, `(item ${rs(itemTax)} + delivery ${rs(deliveryTax)} + platform ${rs(platformTax)})`);
console.log('  ' + '-'.repeat(60));
line('CUSTOMER PAYS', total);

console.log('\n2) WHAT THE RESTAURANT GETS');
line('Its own item value', base, '(subtotal minus the markup)');
line('+ Packaging fee', packagingFee);
line(`- Commission (${commissionRate}%)`, -commission, commissionNote);
line(`- GST on item (${fee.globalGstOnItem || 0}%)`, -gstOnItem);
line(`- GST on commission (${fee.globalGstOnCommission || 0}%)`, -gstOnCommission);
line(`- Payment gateway fee (${fee.globalPaymentGatewayFee || 0}%)`, -paymentGatewayFee, '(charged on the full order total)');
line(`- TCS (${fee.globalTcs || 0}%)`, -tcs);
console.log('  ' + '-'.repeat(60));
line('RESTAURANT GETS', restaurantNet);

console.log('\n3) WHAT THE RIDER GETS');
line('Delivery payout', riderEarning, `(${DISTANCE_KM} km)`);

console.log('\n4) WHAT THE ADMIN / PLATFORM KEEPS');
line('Food markup', markupAmount);
line('Delivery fee collected', deliveryFee);
line('Platform fee', platformFee);
line('Commission', commission);
line('GST on item + TCS', gstOnItem + tcs);
line('Payment gateway fee', paymentGatewayFee);
line('- Paid to the rider', -riderEarning);
console.log('  ' + '-'.repeat(60));
line('ADMIN KEEPS', platformProfit);

console.log('\n5) GST COLLECTED FROM THE CUSTOMER (pass-through)');
line('Held for the government', tax, '(not admin profit, not restaurant earning)');

console.log('\n' + '='.repeat(78));
console.log('CHECK: customer paid = restaurant + rider + admin + GST');
const sum = r2(restaurantNet + riderEarning + platformProfit + tax);
console.log(`  ${rs(restaurantNet)} + ${rs(riderEarning)} + ${rs(platformProfit)} + ${rs(tax)} = ${rs(sum)}  vs paid ${rs(total)}  ${Math.abs(sum - total) < 0.01 ? 'OK' : 'MISMATCH'}`);
console.log('='.repeat(78) + '\n');

await mongoose.disconnect();
