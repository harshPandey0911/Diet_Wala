/**
 * Clears the stored passcode on the demo/QA accounts (see core/auth/testOtpAccounts.js).
 *
 * The code already refuses passcode login for these accounts, so the stored hash is a dead
 * credential; this removes it so the database matches the intent. Only the modules where
 * the passcode is switched off are touched — delivery is left alone.
 *
 * Usage:
 *   node scripts/clear-test-account-passcode.mjs           # dry run
 *   node scripts/clear-test-account-passcode.mjs --apply
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { listTestOtpPhones, isPasscodeDisabledForTestAccount } from '../src/core/auth/testOtpAccounts.js';

const APPLY = process.argv.includes('--apply');
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) {
    console.error('No MONGO_URI / MONGODB_URI in the environment.');
    process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
const db = mongoose.connection.db;

const CLEAR = {
    $set: { hasPasscode: false, passcodeFailedAttempts: 0, passcodeLockedUntil: null },
    $unset: { passcodeHash: 1 },
};

console.log('='.repeat(70));
console.log(APPLY ? 'APPLYING' : 'DRY RUN (nothing will be written)');
console.log(`Demo/QA numbers: ${listTestOtpPhones().join(', ')}`);
console.log('='.repeat(70));

let changed = 0;

for (const phone of listTestOtpPhones()) {
    const suffix = new RegExp(`${phone}$`);
    console.log(`\n${phone}`);

    const targets = [
        {
            module: 'user',
            collection: 'food_users',
            filter: { phone: suffix },
            label: (doc) => doc.name || '(no name)',
        },
        {
            module: 'restaurant',
            collection: 'food_restaurants',
            filter: {
                $or: [
                    { ownerPhone: suffix },
                    { primaryContactNumber: suffix },
                    { ownerPhoneLast10: phone },
                    { ownerPhoneDigits: phone },
                ],
            },
            label: (doc) => doc.restaurantName || '(no name)',
        },
        {
            module: 'delivery',
            collection: 'food_delivery_partners',
            filter: { phone: suffix },
            label: (doc) => doc.name || '(no name)',
        },
    ];

    for (const target of targets) {
        const doc = await db.collection(target.collection).findOne(target.filter);
        if (!doc) {
            console.log(`  ${target.module.padEnd(11)} not found`);
            continue;
        }

        if (!isPasscodeDisabledForTestAccount(target.module, phone)) {
            console.log(
                `  ${target.module.padEnd(11)} ${target.label(doc)} - passcode kept (not disabled for this module)`
            );
            continue;
        }

        if (!doc.hasPasscode && !doc.passcodeHash) {
            console.log(`  ${target.module.padEnd(11)} ${target.label(doc)} - already has no passcode`);
            continue;
        }

        if (APPLY) {
            const result = await db.collection(target.collection).updateOne({ _id: doc._id }, CLEAR);
            changed += result.modifiedCount;
            console.log(`  ${target.module.padEnd(11)} ${target.label(doc)} - passcode CLEARED`);
        } else {
            console.log(`  ${target.module.padEnd(11)} ${target.label(doc)} - would clear passcode`);
        }
    }
}

console.log(
    APPLY
        ? `\nDocuments updated: ${changed}\n`
        : '\nDry run only. Re-run with --apply to clear.\n'
);

await mongoose.disconnect();
