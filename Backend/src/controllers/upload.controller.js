import { ValidationError } from '../core/auth/errors.js';
import { sendResponse } from '../utils/response.js';
import { finalizeGenericUpload } from '../services/upload.service.js';

export const uploadSingle = async (req, res, next) => {
    try {
        if (!req.file) {
            throw new ValidationError('No file provided or invalid file format.');
        }

        const fileUrl = await finalizeGenericUpload(req.file);

        const fileData = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            path: fileUrl,
            url: fileUrl
        };

        return sendResponse(res, 200, 'File uploaded successfully', fileData);
    } catch (error) {
        next(error);
    }
};

export const uploadMultiple = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            throw new ValidationError('No files provided or invalid formats.');
        }

        const filesData = await Promise.all(req.files.map(async (file) => {
            const fileUrl = await finalizeGenericUpload(file);
            return {
                filename: file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                path: fileUrl,
                url: fileUrl
            };
        }));

        return sendResponse(res, 200, 'Files uploaded successfully', { files: filesData });
    } catch (error) {
        next(error);
    }
};
