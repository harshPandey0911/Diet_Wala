import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    getPublicWebsiteController,
    createPublicEnquiryController,
    getAdminWebsiteController,
    updateAdminWebsiteController,
    listAdminEnquiriesController,
    updateAdminEnquiryController,
    deleteAdminEnquiryController
} from '../controllers/website.controller.js';

// Mounted at /v1/food/website (public).
export const publicWebsiteRouter = express.Router();

// A visitor may send a few messages, not hundreds.
const enquiryLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many messages. Please try again in a few minutes.' }
});

publicWebsiteRouter.get('/public', getPublicWebsiteController);
publicWebsiteRouter.post('/enquiry', enquiryLimiter, createPublicEnquiryController);

// Mounted inside the admin router (already requires an admin token): /v1/food/admin/website-content ...
export const adminWebsiteRouter = express.Router();
adminWebsiteRouter.get('/website-content', getAdminWebsiteController);
adminWebsiteRouter.put('/website-content', updateAdminWebsiteController);
adminWebsiteRouter.get('/website-enquiries', listAdminEnquiriesController);
adminWebsiteRouter.patch('/website-enquiries/:id', updateAdminEnquiryController);
adminWebsiteRouter.delete('/website-enquiries/:id', deleteAdminEnquiryController);
