import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const uri = process.env.MONGODB_URI;
mongoose.connect(uri)
  .then(async () => {
    const db = mongoose.connection.db;
    
    const zones = await db.collection('food_zones').find({ name: { $in: ['zone1', 'Indore Zone'] } }).toArray();
    zones.forEach(z => {
      console.log(`\nZone: ${z.name}`);
      console.log(JSON.stringify(z.coordinates));
    });

    mongoose.disconnect();
  })
  .catch(err => {
    console.error(err);
    mongoose.disconnect();
  });
