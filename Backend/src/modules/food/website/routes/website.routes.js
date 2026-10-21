import express from 'express';
import {
    getPublicWebsiteController,
    getAdminWebsiteController,
    updateAdminWebsiteController
} from '../controllers/website.controller.js';

// Mounted at /v1/food/website (public).
export const publicWebsiteRouter = express.Router();
publicWebsiteRouter.get('/public', getPublicWebsiteController);

// Mounted inside the admin router (already requires an admin token): /v1/food/admin/website-content
export const adminWebsiteRouter = express.Router();
adminWebsiteRouter.get('/website-content', getAdminWebsiteController);
adminWebsiteRouter.put('/website-content', updateAdminWebsiteController);
