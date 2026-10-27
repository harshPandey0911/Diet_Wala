import { sendResponse, sendError } from '../../../../utils/response.js';
import { invalidateCache } from '../../../../middleware/cache.js';

// Clear cached customer-facing menus/dish lists so an approved or rejected dish shows (or
// disappears) right away instead of after the cache expires.
const clearFoodCaches = () =>
    Promise.all(['restaurant_menu', 'foods', 'restaurants', 'restaurant_detail'].map((p) => invalidateCache(p + ':*')));
import {
    listPendingFoodApprovals,
    approveFoodItem,
    rejectFoodItem,
    bulkApproveFoodItems
} from '../services/foodApproval.service.js';

export async function getPendingFoodApprovals(req, res, next) {
    try {
        const data = await listPendingFoodApprovals(req.query || {});
        return sendResponse(res, 200, 'Pending food approvals fetched successfully', data);
    } catch (error) {
        next(error);
    }
}

export async function approveFoodItemController(req, res, next) {
    try {
        const updated = await approveFoodItem(req.params.id);
        if (!updated) return sendError(res, 404, 'Food item not found or not pending');
        await clearFoodCaches();
        return sendResponse(res, 200, 'Food item approved successfully', { food: updated });
    } catch (error) {
        next(error);
    }
}

export async function rejectFoodItemController(req, res, next) {
    try {
        const updated = await rejectFoodItem(req.params.id, req.body?.reason);
        if (!updated) return sendError(res, 404, 'Food item not found or not pending');
        await clearFoodCaches();
        return sendResponse(res, 200, 'Food item rejected successfully', { food: updated });
    } catch (error) {
        next(error);
    }
}


export async function bulkApproveFoodItemsController(req, res, next) {
    try {
        const results = await bulkApproveFoodItems(req.body?.ids);
        await clearFoodCaches();
        return sendResponse(res, 200, 'Bulk approval process completed', results);
    } catch (error) {
        next(error);
    }
}
