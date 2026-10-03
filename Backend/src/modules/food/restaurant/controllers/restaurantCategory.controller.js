import {
    listRestaurantCategories,
    listPublicCategories
} from '../services/restaurantCategory.service.js';
import { sendResponse, sendError } from '../../../../utils/response.js';
import { FoodRestaurant } from '../models/restaurant.model.js';

export const listCategoriesController = async (req, res, next) => {
    try {
        const restaurantId = req.user?.userId;
        // Default to restaurant's zone when caller doesn't pass zoneId.
        // This returns (zone categories + global categories) instead of only global.
        const query = { ...(req.query || {}) };
        if (!restaurantId) {
            // Public endpoint: no auth available. Return approved categories (zone-aware).
            const data = await listPublicCategories(query);
            return sendResponse(res, 200, 'Categories fetched successfully', data);
        }

        if (!query.zoneId) {
            const r = await FoodRestaurant.findById(restaurantId).select('zoneId').lean();
            if (r?.zoneId) {
                query.zoneId = String(r.zoneId);
            }
        }
        const data = await listRestaurantCategories(restaurantId, query);
        return sendResponse(res, 200, 'Categories fetched successfully', data);
    } catch (error) {
        next(error);
    }
};

// Categories are managed by admin only. Restaurants can list and use them for foods.
const ADMIN_ONLY_CATEGORY_MESSAGE = 'Only admin can create, edit or delete categories';

export const createCategoryController = async (_req, res) => {
    return sendError(res, 403, ADMIN_ONLY_CATEGORY_MESSAGE);
};

export const updateCategoryController = async (_req, res) => {
    return sendError(res, 403, ADMIN_ONLY_CATEGORY_MESSAGE);
};

export const deleteCategoryController = async (_req, res) => {
    return sendError(res, 403, ADMIN_ONLY_CATEGORY_MESSAGE);
};

