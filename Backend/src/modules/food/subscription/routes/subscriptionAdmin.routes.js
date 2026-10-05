import express from 'express';
import * as subscriptionController from '../controllers/subscription.controller.js';

// Mounted at /v1/food/admin/subscriptions (admin auth is applied by the parent router).
const router = express.Router();

router.get('/zones', subscriptionController.listZonesController);
router.patch('/zones/:zoneId', subscriptionController.updateZoneController);

router.get('/packages', subscriptionController.listPackagesController);
router.post('/packages', subscriptionController.createPackageController);
router.patch('/packages/:id', subscriptionController.updatePackageController);
router.delete('/packages/:id', subscriptionController.deletePackageController);

router.get('/restaurants', subscriptionController.listRestaurantSubscriptionsController);
router.post('/restaurants/:restaurantId/assign', subscriptionController.assignSubscriptionController);
router.patch('/restaurants/:restaurantId/status', subscriptionController.updateSubscriptionStatusController);
router.get('/restaurants/:restaurantId/history', subscriptionController.subscriptionHistoryController);

export default router;
