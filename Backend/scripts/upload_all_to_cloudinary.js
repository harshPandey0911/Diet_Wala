import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'deorxby43';
const API_KEY = process.env.CLOUDINARY_API_KEY || '662689983633438';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || 'TGEa5lpbeXKUYTBq1FKPXjyb-F0';

console.log(`Configuring Cloudinary with Cloud Name: ${CLOUD_NAME}, Key: ${API_KEY}`);

cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true
});

const projectRoot = path.join(__dirname, '../..');
const directoriesToScan = [
    path.join(projectRoot, 'Backend', 'uploads'),
    path.join(projectRoot, 'Frontend', 'public'),
    path.join(projectRoot, 'Frontend', 'src', 'modules', 'Food', 'assets')
];

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif']);

const getAllImageFiles = (dirPath, fileList = []) => {
    if (!fs.existsSync(dirPath)) return fileList;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            getAllImageFiles(fullPath, fileList);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (imageExtensions.has(ext)) {
                fileList.push(fullPath);
            }
        }
    }
    return fileList;
};

async function uploadImages() {
    let allImages = [];
    for (const dir of directoriesToScan) {
        const files = getAllImageFiles(dir);
        allImages = allImages.concat(files);
    }

    // Remove duplicates
    allImages = [...new Set(allImages)];

    console.log(`Found ${allImages.length} images to upload to Cloudinary.`);

    const urlMapping = {};
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < allImages.length; i++) {
        const filePath = allImages[i];
        const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
        const filename = path.basename(filePath, path.extname(filePath));
        
        // Determine folder name in Cloudinary based on directory structure
        let folderInCloudinary = 'diet_wala';
        if (relativePath.includes('uploads')) {
            folderInCloudinary = 'diet_wala/uploads';
        } else if (relativePath.includes('public/food')) {
            folderInCloudinary = 'diet_wala/food';
        } else if (relativePath.includes('public/super-app')) {
            folderInCloudinary = 'diet_wala/super-app';
        } else if (relativePath.includes('assets')) {
            folderInCloudinary = 'diet_wala/assets';
        }

        try {
            console.log(`[${i + 1}/${allImages.length}] Uploading: ${relativePath}...`);
            const resourceType = filePath.endsWith('.svg') ? 'raw' : 'image';
            
            const uploadResult = await cloudinary.uploader.upload(filePath, {
                folder: folderInCloudinary,
                public_id: filename + '_' + Date.now().toString(36),
                resource_type: 'auto',
                overwrite: true
            });

            const secureUrl = uploadResult.secure_url;
            console.log(` -> SUCCESS: ${secureUrl}`);

            urlMapping[relativePath] = secureUrl;
            urlMapping[path.basename(filePath)] = secureUrl;
            if (relativePath.includes('uploads/')) {
                urlMapping['/uploads/' + path.basename(filePath)] = secureUrl;
                urlMapping['uploads/' + path.basename(filePath)] = secureUrl;
            }

            successCount++;
        } catch (err) {
            console.error(` -> ERROR uploading ${relativePath}:`, err.message);
            failCount++;
        }
    }

    console.log(`\n==========================================`);
    console.log(`Upload Complete! Success: ${successCount}, Failed: ${failCount}`);

    // Write mapping to JSON
    const mappingPath = path.join(__dirname, 'cloudinary_urls_mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify(urlMapping, null, 2));
    console.log(`Mapping saved to: ${mappingPath}`);

    // Update MongoDB database if connected
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
        try {
            console.log('\nConnecting to MongoDB to update existing image references in DB...');
            await mongoose.connect(mongoUri);
            console.log('Connected to MongoDB.');

            const db = mongoose.connection.db;
            const collections = await db.listCollections().toArray();

            for (const colInfo of collections) {
                const colName = colInfo.name;
                const collection = db.collection(colName);

                // Find documents that might have image fields with /uploads/
                const docs = await collection.find({}).toArray();
                let updatedInCol = 0;

                for (const doc of docs) {
                    let isModified = false;
                    const docStr = JSON.stringify(doc);

                    for (const [localKey, cloudUrl] of Object.entries(urlMapping)) {
                        if (localKey.startsWith('/uploads/') || localKey.startsWith('uploads/')) {
                            const filename = path.basename(localKey);
                            if (docStr.includes(filename) && !docStr.includes(cloudUrl)) {
                                // Recursively update fields containing the filename
                                const updateFields = (obj) => {
                                    for (const key in obj) {
                                        if (typeof obj[key] === 'string') {
                                            if (obj[key].includes(filename) && !obj[key].includes(cloudUrl)) {
                                                obj[key] = cloudUrl;
                                                isModified = true;
                                            }
                                        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                            updateFields(obj[key]);
                                        }
                                    }
                                };
                                updateFields(doc);
                            }
                        }
                    }

                    if (isModified) {
                        const { _id, ...fieldsToSet } = doc;
                        await collection.replaceOne({ _id }, doc);
                        updatedInCol++;
                    }
                }

                if (updatedInCol > 0) {
                    console.log(`Updated ${updatedInCol} documents in collection: ${colName}`);
                }
            }

            await mongoose.disconnect();
            console.log('MongoDB disconnect successful.');
        } catch (dbErr) {
            console.error('Error updating MongoDB:', dbErr.message);
        }
    }
}

uploadImages().catch(console.error);
