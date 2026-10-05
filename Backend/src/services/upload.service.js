import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const isProduction = () => config.nodeEnv === 'production';

// Resolve this dynamically because production settings may be loaded from the
// database after modules have already been imported during application boot.
export const getUploadDirectory = () => {
    const configuredPath = config.uploadPath || 'uploads';

    // A relative production path such as `uploads/` must not land inside the
    // release directory. Keep it under the server's persistent data location.
    if (isProduction() && !path.isAbsolute(configuredPath)) {
        return path.resolve('/var/www', configuredPath);
    }

    return path.resolve(configuredPath);
};

const ensureUploadDirExists = () => {
    const baseUploadDir = getUploadDirectory();
    if (!fs.existsSync(baseUploadDir)) {
        fs.mkdirSync(baseUploadDir, { recursive: true });
    }
    return baseUploadDir;
};

const uploadIndexCache = {
    expiresAt: 0,
    files: new Map()
};

const UPLOAD_INDEX_TTL_MS = 30 * 1000;
const supportedUploadExtensions = ['.webp', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.pdf', '.mp4', '.webm', '.mov', '.avi', '.mkv', '.bin'];

const getUploadFilesIndex = () => {
    const now = Date.now();
    if (uploadIndexCache.expiresAt > now && uploadIndexCache.files.size > 0) {
        return uploadIndexCache.files;
    }

    const dir = ensureUploadDirExists();
    const nextFiles = new Map();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        nextFiles.set(entry.name.toLowerCase(), entry.name);
    }

    uploadIndexCache.files = nextFiles;
    uploadIndexCache.expiresAt = now + UPLOAD_INDEX_TTL_MS;
    return uploadIndexCache.files;
};

const normalizeUploadToken = (value, fallback = 'upload') => {
    const normalized = String(value || fallback)
        .trim()
        .replace(/[\\/]+/g, '-')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();

    return normalized || fallback;
};

const buildFlatUploadFilename = ({ prefix = 'file', extension = '' }) => {
    const normalizedPrefix = normalizeUploadToken(prefix, 'file');
    const normalizedExtension = extension
        ? `.${String(extension).replace(/^\.+/, '').toLowerCase()}`
        : '';

    return `${normalizedPrefix}_${uuidv4().replace(/-/g, '').substring(0, 10)}${normalizedExtension}`;
};

// Multer memory storage
const storage = multer.memoryStorage();

// File filter (from SOP: jpeg, png, webp, gif)
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'), false);
    }
};

// Multer middleware: max 5MB (from SOP) for specific image endpoints
export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter
});

const uploadToCloudinaryBuffer = async (buffer, folder = 'diet_wala/uploads', filename, resourceType = 'auto') => {
    const cloudName = config.cloudinaryCloudName || process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = config.cloudinaryApiKey || process.env.CLOUDINARY_API_KEY;
    const apiSecret = config.cloudinaryApiSecret || process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        logger.error(
            `[Upload] Cloudinary credentials missing (NODE_ENV=${config.nodeEnv}): ` +
            `CLOUDINARY_CLOUD_NAME=${cloudName ? 'set' : 'MISSING'}, ` +
            `CLOUDINARY_API_KEY=${apiKey ? 'set' : 'MISSING'}, ` +
            `CLOUDINARY_API_SECRET=${apiSecret ? 'set' : 'MISSING'}`
        );
        return null;
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
    });

    return new Promise((resolve) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                // Raw files (e.g. PDF) keep their extension in the public id so the URL stays downloadable.
                public_id: filename
                    ? (resourceType === 'raw' ? filename : filename.replace(/\.[^/.]+$/, ''))
                    : undefined,
                resource_type: resourceType
            },
            (error, result) => {
                if (error) {
                    logger.error(
                        `[Upload] Cloudinary rejected upload (NODE_ENV=${config.nodeEnv}, cloud=${cloudName}): ` +
                        `${error.message}${error.http_code ? ` [http ${error.http_code}]` : ''}`
                    );
                    return resolve(null);
                }
                resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
};

/**
 * Processes and saves an image buffer to Cloudinary (or fallback to single upload directory).
 * Returns the Cloudinary URL or relative public path (e.g., '/uploads/food_123.webp')
 */
const processAndSaveImage = async ({ buffer, prefix, folder = 'banners', width, height, quality = 80 }) => {
    const filename = buildFlatUploadFilename({ prefix, extension: 'webp' });

    let sharpInstance = sharp(buffer);

    if (width || height) {
        sharpInstance = sharpInstance.resize({
            width,
            height,
            fit: 'inside',
            withoutEnlargement: true
        });
    }

    const processedBuffer = await sharpInstance
        .webp({ quality })
        .toBuffer();

    if (isProduction()) {
        const filepath = path.join(ensureUploadDirExists(), filename);
        fs.writeFileSync(filepath, processedBuffer);
        return `/uploads/${filename}`;
    }

    // Local/development image uploads must be durable and centralized in
    // Cloudinary. Do not silently fall back to a machine-local uploads folder.
    const cloudinaryFolder = `diet_wala/${folder}`;
    const cloudinaryUrl = await uploadToCloudinaryBuffer(processedBuffer, cloudinaryFolder, filename);
    if (!cloudinaryUrl) {
        logger.error(`[Upload] Cloudinary image upload failed for "${filename}" in ${config.nodeEnv} mode.`);
        throw new Error(
            'Cloudinary image upload failed. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.'
        );
    }

    return cloudinaryUrl;
};

/**
 * Exported specific processing functions as per SOP
 */

export const uploadFoodImage = async (buffer) => {
    return processAndSaveImage({
        buffer,
        folder: 'foods',
        prefix: 'food',
        width: 800,
        height: 800,
        quality: 85
    });
};

export const uploadRestaurantImage = async (buffer) => {
    return processAndSaveImage({
        buffer,
        folder: 'restaurants',
        prefix: 'restaurant',
        width: 1200,
        height: 800,
        quality: 85
    });
};

export const uploadBannerImage = async (buffer) => {
    return processAndSaveImage({
        buffer,
        folder: 'banners',
        prefix: 'banner',
        width: 1600,
        height: 600,
        quality: 85
    });
};

export const uploadProfileImage = async (buffer) => {
    return processAndSaveImage({
        buffer,
        folder: 'users',
        prefix: 'user',
        width: 400,
        height: 400,
        quality: 85
    });
};

export const uploadDeliveryImage = async (buffer) => {
    return processAndSaveImage({
        buffer,
        folder: 'delivery',
        prefix: 'delivery',
        width: 800,
        height: 800,
        quality: 85
    });
};

export const uploadGenericImage = async (buffer, folder = 'misc') => {
    return processAndSaveImage({
        buffer,
        folder,
        prefix: 'img',
        quality: 85
    });
};

export const uploadFileBuffer = async (buffer, _folder = 'misc', options = {}) => {
    const dir = ensureUploadDirExists();
    const prefix = normalizeUploadToken(options.fileName ? options.fileName.split('.')[0] : 'file', 'file');
    const filename = buildFlatUploadFilename({
        prefix,
        extension: options.format || 'bin'
    });
    const filepath = path.join(dir, filename);

    if (!isProduction()) {
        const cloudinaryUrl = await uploadToCloudinaryBuffer(buffer, 'diet_wala/files', filename, 'raw');
        if (!cloudinaryUrl) {
            logger.error(`[Upload] Cloudinary file upload failed for "${filename}" in ${config.nodeEnv} mode.`);
            throw new Error('Cloudinary file upload failed. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.');
        }
        return cloudinaryUrl;
    }

    fs.writeFileSync(filepath, buffer);
    return `/uploads/${filename}`;
};

export const uploadVideoBuffer = async (buffer, _folder = 'videos', options = {}) => {
    const dir = ensureUploadDirExists();
    const filename = buildFlatUploadFilename({
        prefix: 'video',
        extension: options.format ? normalizeUploadToken(options.format, 'mp4') : 'mp4'
    });
    const filepath = path.join(dir, filename);

    if (!isProduction()) {
        const cloudinaryUrl = await uploadToCloudinaryBuffer(buffer, 'diet_wala/videos', filename, 'video');
        if (!cloudinaryUrl) {
            logger.error(`[Upload] Cloudinary video upload failed for "${filename}" in ${config.nodeEnv} mode.`);
            throw new Error('Cloudinary video upload failed. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.');
        }
        return cloudinaryUrl;
    }

    fs.writeFileSync(filepath, buffer);
    return `/uploads/${filename}`;
};

export const buildRawDownloadUrlFromFileUrl = (fileUrl, options = {}) => {
    return fileUrl;
};

export const normalizeStoredUploadPath = (value) => {
    if (value === null || value === undefined) return '';

    const trimmed = String(value).trim();
    if (!trimmed) return '';

    const externalSchemes = ['http://', 'https://'];
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

    if (externalSchemes.some((prefix) => trimmed.startsWith(prefix))) {
        try {
            const url = new URL(trimmed);
            if (!localHosts.has(url.hostname)) {
                return trimmed;
            }
            const localPath = url.pathname || '';
            return normalizeStoredUploadPath(localPath);
        } catch {
            return trimmed;
        }
    }

    const normalized = trimmed
        .split('?')[0]
        .split('#')[0]
        .replace(/\\/g, '/');

    const filename = path.posix.basename(normalized);
    if (!filename || filename === '.' || filename === '/') return '';

    return `/uploads/${filename}`;
};

export const resolveStoredUploadPath = (value) => {
    const normalized = normalizeStoredUploadPath(value);
    if (!normalized) return '';
    if (/^https?:\/\//i.test(String(value || '').trim())) return String(value).trim();

    const filename = path.posix.basename(normalized);
    if (!filename) return normalized;

    const uploadFiles = getUploadFilesIndex();
    const parsed = path.posix.parse(filename);
    const stem = parsed.name.toLowerCase();
    if (!stem) return normalized;

    const webpCandidate = uploadFiles.get(`${stem}.webp`);
    if (webpCandidate) {
        return `/uploads/${webpCandidate}`;
    }

    const exact = uploadFiles.get(filename.toLowerCase());
    if (exact) {
        return `/uploads/${exact}`;
    }

    for (const ext of supportedUploadExtensions) {
        const candidate = uploadFiles.get(`${stem}${ext}`);
        if (candidate) {
            return `/uploads/${candidate}`;
        }
    }

    const prefixMatches = Array.from(uploadFiles.entries())
        .filter(([lowerName]) => {
            const parsedName = path.posix.parse(lowerName);
            return parsedName.name === stem || parsedName.name.startsWith(`${stem}_`);
        })
        .map(([, actualName]) => actualName)
        .sort((a, b) => {
            const aExt = path.posix.extname(a).toLowerCase();
            const bExt = path.posix.extname(b).toLowerCase();
            const aRank = supportedUploadExtensions.indexOf(aExt);
            const bRank = supportedUploadExtensions.indexOf(bExt);
            if (aRank !== bRank) return aRank - bRank;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

    if (prefixMatches.length > 0) {
        return `/uploads/${prefixMatches[0]}`;
    }

    return `/uploads/${filename}`;
};

// --- Generic Production-Ready File Upload System ---

const genericStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, ensureUploadDirExists());
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '';
        const name = normalizeUploadToken(path.basename(file.originalname, ext), file.mimetype.split('/')[0] || 'file');
        const normalizedExt = ext ? ext.replace(/^\.+/, '').toLowerCase() : '';
        cb(null, buildFlatUploadFilename({ prefix: name, extension: normalizedExt }));
    }
});

const genericFileFilter = (req, file, cb) => {
    const allowed = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/webm',
        'application/pdf'
    ];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only images, videos, and PDFs are supported.`), false);
    }
};

export const genericUpload = multer({
    storage: genericStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: genericFileFilter
});


/**
 * Generic multer upload writes to disk first. Production keeps the file in the upload
 * folder; local/dev moves it to Cloudinary and removes the temporary local copy so
 * local machines never create `/uploads/...` paths that live cannot serve.
 * Returns the public URL to store in the DB.
 */
export const finalizeGenericUpload = async (file) => {
    if (isProduction()) {
        return `/uploads/${file.filename}`;
    }

    const mimeType = String(file.mimetype || '').toLowerCase();
    const resourceType = mimeType.startsWith('video/') ? 'video' : mimeType === 'application/pdf' ? 'raw' : 'image';
    const buffer = fs.readFileSync(file.path);
    const cloudinaryUrl = await uploadToCloudinaryBuffer(buffer, 'diet_wala/uploads', file.filename, resourceType);
    if (!cloudinaryUrl) {
        logger.error(`[Upload] Cloudinary upload failed for "${file.filename}" in ${config.nodeEnv} mode.`);
        throw new Error('Cloudinary upload failed. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.');
    }

    try {
        fs.unlinkSync(file.path);
    } catch {
        // Temporary local copy; ignore cleanup errors.
    }
    return cloudinaryUrl;
};
