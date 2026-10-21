import { getWebsiteContent, saveWebsiteContent, getWebsiteDefaults } from '../services/website.service.js';
import { sendResponse } from '../../../../utils/response.js';

// ----- Public -----
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
        const content = await getWebsiteContent();
        return sendResponse(res, 200, 'Website content fetched', { content, defaults: getWebsiteDefaults() });
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
