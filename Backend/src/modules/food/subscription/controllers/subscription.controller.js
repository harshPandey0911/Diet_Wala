import { sendResponse } from '../../../../utils/response.js';
import {
    listZoneSubscriptionSettings,
    setZoneSubscriptionEnabled,
    listPackages,
    createPackage,
    updatePackage,
    deletePackage,
    listRestaurantSubscriptions,
    assignSubscription,
    setSubscriptionStatus,
    getRestaurantSubscriptionHistory,
    getMySubscription
} from '../services/subscription.service.js';

const handle = (fn) => async (req, res, next) => {
    try {
        await fn(req, res);
    } catch (error) {
        next(error);
    }
};

// ----- Admin -----

export const listZonesController = handle(async (req, res) => {
    const zones = await listZoneSubscriptionSettings();
    return sendResponse(res, 200, 'Zone subscription settings fetched', { zones });
});

export const updateZoneController = handle(async (req, res) => {
    const result = await setZoneSubscriptionEnabled(req.params.zoneId, req.body?.enabled === true, req.user?.userId);
    return sendResponse(res, 200, result.subscriptionEnabled ? 'Subscription turned on for zone' : 'Subscription turned off for zone', result);
});

export const listPackagesController = handle(async (req, res) => {
    const packages = await listPackages();
    return sendResponse(res, 200, 'Packages fetched', { packages });
});

export const createPackageController = handle(async (req, res) => {
    const pkg = await createPackage(req.body || {});
    return sendResponse(res, 201, 'Package created', { package: pkg });
});

export const updatePackageController = handle(async (req, res) => {
    const pkg = await updatePackage(req.params.id, req.body || {});
    return sendResponse(res, 200, 'Package updated', { package: pkg });
});

export const deletePackageController = handle(async (req, res) => {
    const result = await deletePackage(req.params.id);
    return sendResponse(res, 200, 'Package deleted', result);
});

export const listRestaurantSubscriptionsController = handle(async (req, res) => {
    const data = await listRestaurantSubscriptions(req.query || {});
    return sendResponse(res, 200, 'Restaurant subscriptions fetched', data);
});

export const assignSubscriptionController = handle(async (req, res) => {
    const subscription = await assignSubscription(req.params.restaurantId, req.body || {}, req.user?.userId);
    return sendResponse(res, 200, 'Subscription assigned', { subscription });
});

export const updateSubscriptionStatusController = handle(async (req, res) => {
    const subscription = await setSubscriptionStatus(req.params.restaurantId, req.body?.status);
    return sendResponse(res, 200, `Subscription marked ${subscription.status}`, { subscription });
});

export const subscriptionHistoryController = handle(async (req, res) => {
    const history = await getRestaurantSubscriptionHistory(req.params.restaurantId);
    return sendResponse(res, 200, 'Subscription history fetched', { history });
});

// ----- Restaurant -----

export const getMySubscriptionController = handle(async (req, res) => {
    const data = await getMySubscription(req.user?.userId);
    return sendResponse(res, 200, 'Subscription fetched', data);
});
