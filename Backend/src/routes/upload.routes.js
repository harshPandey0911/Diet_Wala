import { Router } from 'express';
import { uploadSingle, uploadMultiple } from '../controllers/upload.controller.js';
import { genericUpload } from '../services/upload.service.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

// Routes for generic file uploads
router.post('/image', authMiddleware, genericUpload.single('file'), uploadSingle);
router.post('/single', authMiddleware, genericUpload.single('file'), uploadSingle);
router.post('/multiple', authMiddleware, genericUpload.array('files', 20), uploadMultiple);

export default router;
