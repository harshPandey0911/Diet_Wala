/**
 * Read-only check: finds every `/uploads/<file>` path saved in the database and reports
 * the ones that do not exist in this machine's upload folder.
 *
 * Usage (run on the machine whose upload folder you want to verify):
 *   node scripts/check-missing-uploads.js
 *   NODE_ENV=production node scripts/check-missing-uploads.js   # checks /var/www/uploads
 *
 * Nothing is modified or deleted.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'node:dns/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendRoot, '.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
const isProduction = (process.env.NODE_ENV || 'development') === 'production';
const configuredPath = process.env.UPLOAD_DIR || process.env.UPLOAD_PATH || (isProduction ? '/var/www/uploads' : 'uploads/');
// Mirrors getUploadDirectory() in src/services/upload.service.js
const uploadDir = isProduction && !path.isAbsolute(configuredPath)
    ? path.resolve('/var/www', configuredPath)
    : path.resolve(backendRoot, configuredPath);

const collect = (value, out) => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach((v) => collect(v, out));
    else if (value && typeof value === 'object' && !(value instanceof Date) && !value._bsontype) {
        Object.values(value).forEach((v) => collect(v, out));
    }
};

const run = async () => {
    if (!mongoUri) throw new Error('MONGODB_URI is not set');
    if (!fs.existsSync(uploadDir)) {
        console.log(`Upload folder does not exist: ${uploadDir}`);
    }
    const onDisk = new Set(fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).map((f) => f.toLowerCase()) : []);

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 20000 });
    const db = mongoose.connection.db;
    const collections = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => n.startsWith('food_'));

    const missing = new Map(); // filename -> Set(collection)
    let totalRefs = 0;
    for (const name of collections) {
        const cursor = db.collection(name).find({});
        for await (const doc of cursor) {
            const strings = [];
            collect(doc, strings);
            for (const s of strings) {
                if (!/(^|\/)uploads\/[^/?#]+/.test(s) || /res\.cloudinary\.com/.test(s)) continue;
                totalRefs += 1;
                const file = path.posix.basename(s.split('?')[0].split('#')[0]);
                if (!onDisk.has(file.toLowerCase())) {
                    if (!missing.has(file)) missing.set(file, new Set());
                    missing.get(file).add(name);
                }
            }
        }
    }

    console.log(`Upload folder : ${uploadDir}`);
    console.log(`Files on disk : ${onDisk.size}`);
    console.log(`DB references : ${totalRefs}`);
    console.log(`Missing files : ${missing.size}`);
    for (const [file, cols] of missing) {
        console.log(`  - ${file}  (${[...cols].join(', ')})`);
    }
    await mongoose.disconnect();
};

run().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
