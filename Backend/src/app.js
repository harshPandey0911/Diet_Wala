import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'mongo-sanitize';
import xssClean from 'xss-clean';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { responseTimeLogger } from './middleware/responseTimeLogger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { healthCheck } from './config/health.js';
import { config } from './config/env.js';
import { getUploadDirectory } from './services/upload.service.js';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const app = express();

// Add compression middleware to compress JSON payloads (Gzip)
app.use(compression());

// Trust first proxy (essential for express-rate-limit if behind a proxy)
app.set('trust proxy', 1);

// Request ID tracing (before other middlewares so all logs can use it)
app.use(requestIdMiddleware);

// Root endpoint (no rate limit, minimal JSON, no secrets)
app.get('/', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'DietVala API' });
});
// Health endpoints (no rate limit, minimal JSON, no secrets)
app.get('/health', async (_req, res) => {
    try {
        const data = await healthCheck();
        res.status(200).json(data);
    } catch (err) {
        res.status(503).json({ status: 'DOWN', error: 'Health check failed' });
    }
});
app.get('/ready', (_req, res) => {
    res.status(200).json({ status: 'ready' });
});

// Security & parsing middlewares
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                'https://maps.googleapis.com',
                'https://maps.gstatic.com',
                'https://checkout.razorpay.com',
                'blob:'
            ],
            scriptSrcElem: [
                "'self'",
                "'unsafe-inline'",
                'https://maps.googleapis.com',
                'https://maps.gstatic.com',
                'https://checkout.razorpay.com',
                'blob:'
            ],
            connectSrc: [
                "'self'",
                'https://maps.googleapis.com',
                'https://maps.gstatic.com',
                'https://api.razorpay.com',
                'https://checkout.razorpay.com',
                'wss:',
                'ws:'
            ],
            frameSrc: [
                "'self'",
                'https://api.razorpay.com',
                'https://checkout.razorpay.com'
            ]
        }
    },
    hsts: config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({
    limit: '15mb',
    verify: (req, res, buf) => {
        // ✅ Store rawBody for signature verification (Razorpay Webhooks)
        if (req.originalUrl && req.originalUrl.includes('/webhook/razorpay')) {
            req.rawBody = buf;
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Protect against NoSQL injection and XSS
app.use((req, _res, next) => {
    req.body = mongoSanitize(req.body);
    req.query = mongoSanitize(req.query);
    req.params = mongoSanitize(req.params);
    next();
});
app.use(xssClean());

// Global rate limiting for API routes has been removed to allow public routes to be free.
// Rate limiting for private routes is now handled inside authMiddleware.

// On-the-fly thumbnails: a resized WebP (cached on disk in uploads/.thumbs), so a list screen
// downloads ~15 KB per picture instead of the full 200+ KB original. Two URL forms:
//   /api/thumbs/<width>/<file>   - used by the apps. Lives under /api because on the live server nginx
//                                  serves /uploads/* straight from disk and never forwards it to Node.
//   /uploads/<file>?w=<width>    - older form, only works where /uploads reaches Node.
const THUMB_WIDTHS = new Set([100, 150, 200, 300, 400, 600, 800, 1200]);
const THUMB_SOURCE_EXT = /\.(webp|png|jpe?g)$/i;
const thumbInFlight = new Map();

const getThumbFile = async (relativePath, width) => {
    if (!THUMB_WIDTHS.has(width)) return null;
    const relative = decodeURIComponent(relativePath || '').replace(/^\/+/, '');
    if (!relative || relative.includes('..') || !THUMB_SOURCE_EXT.test(relative)) return null;

    const root = path.resolve(getUploadDirectory());
    const source = path.resolve(root, relative);
    if (!source.startsWith(root + path.sep) || !fs.existsSync(source)) return null;

    const cacheDir = path.join(root, '.thumbs');
    const cacheFile = path.join(cacheDir, `${relative.replace(/[\/]/g, '_')}.w${width}.webp`);
    const sourceStat = fs.statSync(source);
    const cacheStat = fs.existsSync(cacheFile) ? fs.statSync(cacheFile) : null;

    if (!cacheStat || cacheStat.mtimeMs < sourceStat.mtimeMs) {
        let job = thumbInFlight.get(cacheFile);
        if (!job) {
            job = (async () => {
                await fs.promises.mkdir(cacheDir, { recursive: true });
                const tmp = `${cacheFile}.${process.pid}.tmp`;
                await sharp(source).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 75, effort: 4 }).toFile(tmp);
                await fs.promises.rename(tmp, cacheFile);
            })().finally(() => thumbInFlight.delete(cacheFile));
            thumbInFlight.set(cacheFile, job);
        }
        await job;
    }
    return cacheFile;
};

const sendThumb = (res, cacheFile) => {
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.type('image/webp');
    return res.sendFile(cacheFile);
};

app.get(/^\/api\/thumbs\/(\d+)\/(.+)$/, async (req, res) => {
    const width = Number(req.params[0]);
    const relative = req.params[1];
    try {
        const cacheFile = await getThumbFile(relative, width);
        if (cacheFile) return sendThumb(res, cacheFile);
    } catch (_error) {
        // fall through to the original file
    }
    // Unknown width, missing file or resize problem: send the browser to the original picture.
    if (relative.includes('..')) return res.status(404).end();
    return res.redirect(302, `/uploads/${encodeURI(relative)}`);
});

// Optional: log API response time (method, path, status, duration) - no sensitive data
app.use('/api', responseTimeLogger);

// API Routes
app.use('/api', routes);

// Static file serving for uploads. Resolve lazily so settings loaded during
// application bootstrap are honored without requiring a process restart.
const uploadStaticOptions = {
    // Upload file names are unique (hash in the name), so browsers can keep them for a long time.
    maxAge: '30d',
    immutable: true,
    setHeaders: (res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
};
let uploadStaticRoot = '';
let uploadStaticHandler = null;

app.use(['/var/www/uploads', '/uploads'], async (req, res, next) => {
    try {
        if (req.method !== 'GET' || !req.query?.w) return next();
        const cacheFile = await getThumbFile(req.path, Number(req.query.w));
        return cacheFile ? sendThumb(res, cacheFile) : next();
    } catch (_error) {
        // Any problem: fall back to the original file.
        return next();
    }
});

app.use(['/var/www/uploads', '/uploads'], (req, res, next) => {
    const currentRoot = getUploadDirectory();
    if (!uploadStaticHandler || uploadStaticRoot !== currentRoot) {
        uploadStaticRoot = currentRoot;
        uploadStaticHandler = express.static(currentRoot, uploadStaticOptions);
    }
    return uploadStaticHandler(req, res, next);
});

// Error Handling
app.use(errorHandler);

export default app;
