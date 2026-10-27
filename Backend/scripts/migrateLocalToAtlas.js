import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const LOCAL_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/test';
const ATLAS_URI = process.env.ATLAS_MONGODB_URI;

if (!ATLAS_URI) {
    console.error('Error: ATLAS_MONGODB_URI is not defined in .env');
    process.exit(1);
}

const collectionsToCopy = [
    'food_users',
    'food_restaurants',
    'food_restaurant_outlet_timings',
    'food_admins',
    'food_items',
    'food_addons',
    'food_categories',
    'food_dining_categories',
    'food_hero_banners',
    'food_under250_banners',
    'food_dining_banners',
    'food_explore_icons',
    'promocodes',
    'food_offers',
    'food_orders',
    'transactions',
    'payments',
    'food_delivery_partners',
    'food_feedback_experiences',
    'envsettings',
    'foodbusinesssettings',
    'food_landing_settings',
    'food_settings',
    'food_fee_settings',
    'appconfigs',
    'food_zones'
];

async function migrate() {
    let localClient, atlasClient;
    try {
        console.log(`Connecting to local DB...`);
        localClient = new MongoClient(LOCAL_URI);
        await localClient.connect();
        const localDb = localClient.db();

        console.log(`Connecting to Atlas DB...`);
        atlasClient = new MongoClient(ATLAS_URI);
        await atlasClient.connect();
        const atlasDb = atlasClient.db();

        if (process.env.CLEAR_ATLAS === 'true') {
            console.log('CLEAR_ATLAS is true. Clearing Atlas collections...');
            for (const collName of collectionsToCopy) {
                try {
                    await atlasDb.collection(collName).drop();
                    console.log(`Dropped ${collName} on Atlas`);
                } catch (e) {
                    if (e.code !== 26) { // 26 is namespace not found
                        console.error(`Error dropping ${collName}:`, e.message);
                    }
                }
            }
        }

        let totalRecordsCopied = 0;
        const copiedCollections = [];

        for (const collName of collectionsToCopy) {
            console.log(`Processing collection: ${collName}`);
            
            const localCollection = localDb.collection(collName);
            const atlasCollection = atlasDb.collection(collName);
            
            const documents = await localCollection.find({}).toArray();
            if (documents.length > 0) {
                // If not clearing atlas, we might want to avoid duplicates. 
                // A safe way for a migration is to use bulkWrite with upsert or just insertMany if we assume empty atlas.
                // The prompt says "Atlas is empty". So we can just insertMany.
                try {
                    await atlasCollection.insertMany(documents, { ordered: false });
                    console.log(`Copied ${documents.length} records to ${collName}`);
                    totalRecordsCopied += documents.length;
                    copiedCollections.push(collName);
                } catch (err) {
                    // if some duplicates exist because ordered is false, it might throw, but it will continue
                    console.error(`Warning: Some records in ${collName} failed to insert (maybe duplicates).`);
                    // We can also count how many were actually inserted if there was a partial error.
                    if (err.insertedCount) {
                        totalRecordsCopied += err.insertedCount;
                        copiedCollections.push(collName);
                        console.log(`Successfully copied ${err.insertedCount} records to ${collName} despite some errors.`);
                    } else if (err.writeErrors) {
                         const inserted = documents.length - err.writeErrors.length;
                         totalRecordsCopied += inserted;
                         if(inserted > 0 && !copiedCollections.includes(collName)) copiedCollections.push(collName);
                         console.log(`Successfully copied ${inserted} records to ${collName} despite some errors.`);
                    }
                }
            } else {
                console.log(`No records found in local collection ${collName}`);
            }
        }

        console.log(`\nMigration completed successfully!`);
        console.log(`Total records copied: ${totalRecordsCopied}`);
        console.log(`Collections copied: ${copiedCollections.join(', ')}`);
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (localClient) await localClient.close();
        if (atlasClient) await atlasClient.close();
    }
}

migrate();
