import * as diningService from '../services/dining.service.js';

export async function getPublicDiningCategories(req, res, next) {
    try {
        const categories = await diningService.listDiningCategoriesPublic();
        res.status(200).json({ success: true, message: 'Dining categories fetched successfully', data: categories });
    } catch (error) {
        next(error);
    }
}

export async function getPublicDiningRestaurants(req, res, next) {
    try {
        const restaurants = await diningService.listDiningRestaurantsPublic(req.query || {});
        res.status(200).json({ success: true, message: 'Dining restaurants fetched successfully', data: restaurants });
    } catch (error) {
        next(error);
    }
}

export async function getPublicRestaurantOccupiedSeats(req, res, next) {
    try {
        const { restaurantId } = req.params;
        const occupiedSeats = await diningService.getRestaurantOccupiedSeats(restaurantId);
        res.status(200).json({ success: true, message: 'Occupied seats fetched successfully', data: { occupiedSeats } });
    } catch (error) {
        next(error);
    }
}

export async function getPublicSlotAvailability(req, res, next) {
    try {
        const { restaurantId } = req.params;
        const { date, timeSlot } = req.query;

        if (!date || !timeSlot) {
            return res.status(400).json({ success: false, message: 'date and timeSlot query params are required' });
        }

        const occupiedSeats = await diningService.getRestaurantOccupiedSeats(restaurantId, date, timeSlot);
        res.status(200).json({ success: true, message: 'Slot availability fetched successfully', data: { occupiedSeats } });
    } catch (error) {
        next(error);
    }
}

