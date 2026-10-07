import express, { Router } from 'express';
import { uploadSingle, uploadMultiple } from '../controllers/upload.controller.js';
import { genericUpload, getUploadDirectory } from '../services/upload.service.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

// Public media delivery through the API prefix. On production the frontend and
// API are commonly split by Nginx, where `/uploads/*` may otherwise fall back
// to the SPA's index.html instead of reaching Express.
const uploadStaticOptions = {
    maxAge: '7d',
    setHeaders: (res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
};
let uploadStaticRoot = '';
let uploadStaticHandler = null;
router.use('/files', (req, res, next) => {
    const currentRoot = getUploadDirectory();
    if (!uploadStaticHandler || uploadStaticRoot !== currentRoot) {
        uploadStaticRoot = currentRoot;
        uploadStaticHandler = express.static(currentRoot, uploadStaticOptions);
    }
    return uploadStaticHandler(req, res, next);
});

// Routes for generic file uploads
router.post('/image', authMiddleware, genericUpload.single('file'), uploadSingle);
router.post('/single', authMiddleware, genericUpload.single('file'), uploadSingle);
router.post('/multiple', authMiddleware, genericUpload.array('files', 20), uploadMultiple);

export default router;
