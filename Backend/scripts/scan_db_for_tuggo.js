import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tuggo_food';

function searchInValue(value, pathPrefix, matches, collectionName, docId) {
  if (value === null || value === undefined) return;

  if (typeof value === 'string') {
    if (/tuggo/i.test(value)) {
      matches.push({
        collection: collectionName,
        docId: String(docId),
        field: pathPrefix,
        value: value.length > 100 ? value.substring(0, 100) + '...' : value
      });
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => {
      searchInValue(item, `${pathPrefix}[${index}]`, matches, collectionName, docId);
    });
  } else if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      // Check if key itself contains tuggo
      if (/tuggo/i.test(key)) {
        matches.push({
          collection: collectionName,
          docId: String(docId),
          field: `[KEY] ${currentPath}`,
          value: key
        });
      }
      searchInValue(value[key], currentPath, matches, collectionName, docId);
    }
  }
}

async function analyzeDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('URI:', MONGO_URI.replace(/:([^:@]+)@/, ':****@'));
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB successfully!');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log(`Found ${collections.length} collection(s) in DB.`);

    const allMatches = [];

    for (const colInfo of collections) {
      const colName = colInfo.name;
      console.log(`Scanning collection: ${colName}...`);
      const collection = db.collection(colName);
      const cursor = collection.find({});

      let count = 0;
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        count++;
        const docId = doc._id || doc.id || count;
        searchInValue(doc, '', allMatches, colName, docId);
      }
    }

    console.log('\n================ DB SCAN RESULTS ================');
    console.log(`Total "tuggo" occurrences found: ${allMatches.length}`);

    const resultPath = path.join(__dirname, 'db_tuggo_analysis.json');
    fs.writeFileSync(resultPath, JSON.stringify(allMatches, null, 2));

    await mongoose.disconnect();
    console.log(`Analysis saved to ${resultPath}`);
    process.exit(0);
  } catch (error) {
    console.error('Error during DB scan:', error);
    process.exit(1);
  }
}

analyzeDatabase();
