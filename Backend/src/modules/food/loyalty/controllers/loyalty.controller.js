import { sendResponse } from '../../../../utils/response.js';
import { validateLoyaltySettingsUpsertDto } from '../validators/loyaltySettings.validator.js';
import * as loyaltyService from '../services/loyalty.service.js';

// ----- Admin -----

export const getLoyaltySettingsController = async (req, res, next) => {
    try {
        const settings = await loyaltyService.getLoyaltySettings();
        return sendResponse(res, 200, 'Loyalty settings fetched successfully', { settings });
    } catch (error) {
        next(error);
    }
};

export const upsertLoyaltySettingsController = async (req, res, next) => {
    try {
        const body = validateLoyaltySettingsUpsertDto(req.body || {});
        const settings = await loyaltyService.upsertLoyaltySettings(body);
        return sendResponse(res, 200, 'Loyalty settings saved successfully', { settings });
    } catch (error) {
        next(error);
    }
};

export const getAdminLoyaltyLedgerController = async (req, res, next) => {
    try {
        const result = await loyaltyService.getAdminLoyaltyLedger(req.query || {});
        return sendResponse(res, 200, 'Loyalty ledger fetched successfully', result);
    } catch (error) {
        next(error);
    }
};

export const adminAdjustUserPointsController = async (req, res, next) => {
    try {
        const { userId, points, description } = req.body || {};
        const result = await loyaltyService.adminAdjustUserPoints({
            userId,
            points,
            description,
            adminId: req.user?.userId || req.user?.adminId
        });
        return sendResponse(res, 200, 'Points adjusted successfully', result);
    } catch (error) {
        next(error);
    }
};

// ----- User -----

export const getUserLoyaltySummaryController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const summary = await loyaltyService.getUserPointsSummary(userId);
        return sendResponse(res, 200, 'Loyalty points fetched successfully', summary);
    } catch (error) {
        next(error);
    }
};

export const getUserLoyaltyHistoryController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const result = await loyaltyService.getUserPointsHistory(userId, req.query || {});
        return sendResponse(res, 200, 'Loyalty points history fetched successfully', result);
    } catch (error) {
        next(error);
    }
};

export const previewRedeemPointsController = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { orderSubtotal, points } = req.body || {};
        const result = await loyaltyService.computePointsRedemption(userId, orderSubtotal, points);
        return sendResponse(res, 200, 'Redemption preview calculated', result);
    } catch (error) {
        next(error);
    }
};
