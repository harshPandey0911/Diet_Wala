import {
    getWebsiteContent,
    saveWebsiteContent,
    getWebsiteDefaults,
    createEnquiry,
    listEnquiries,
    countNewEnquiries,
    setEnquiryStatus,
    deleteEnquiry
} from '../services/website.service.js';
import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { sendResponse } from '../../../../utils/response.js';

// ----- Public -----
export const createPublicEnquiryController = async (req, res, next) => {
    try {
        const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
        await createEnquiry(req.body || {}, { ip });
        return sendResponse(res, 201, 'Message received', null);
    } catch (error) {
        next(error);
    }
};

export const getPublicWebsiteController = async (req, res, next) => {
    try {
        const content = await getWebsiteContent();
        return sendResponse(res, 200, 'Website content fetched', content);
    } catch (error) {
        next(error);
    }
};

// ----- Admin -----
export const getAdminWebsiteController = async (req, res, next) => {
    try {
        const [content, newEnquiries] = await Promise.all([getWebsiteContent(), countNewEnquiries()]);
        return sendResponse(res, 200, 'Website content fetched', { content, defaults: getWebsiteDefaults(), newEnquiries });
    } catch (error) {
        next(error);
    }
};

export const updateAdminWebsiteController = async (req, res, next) => {
    try {
        const content = await saveWebsiteContent(req.body?.content);
        return sendResponse(res, 200, 'Website content saved', content);
    } catch (error) {
        next(error);
    }
};

const requireId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid message id');
    return id;
};

export const listAdminEnquiriesController = async (req, res, next) => {
    try {
        const enquiries = await listEnquiries();
        return sendResponse(res, 200, 'Messages fetched', { enquiries });
    } catch (error) {
        next(error);
    }
};

export const updateAdminEnquiryController = async (req, res, next) => {
    try {
        const updated = await setEnquiryStatus(requireId(req.params.id), req.body?.status);
        return sendResponse(res, 200, 'Message updated', updated);
    } catch (error) {
        next(error);
    }
};

export const deleteAdminEnquiryController = async (req, res, next) => {
    try {
        const result = await deleteEnquiry(requireId(req.params.id));
        return sendResponse(res, 200, 'Message deleted', result);
    } catch (error) {
        next(error);
    }
};
