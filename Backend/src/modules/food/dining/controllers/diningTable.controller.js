import mongoose from 'mongoose';
import * as diningService from '../services/dining.service.js';

// ─── RESTAURANT: Create a new table ──────────────────────────────────────────
export async function createDiningTable(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const table = await diningService.createDiningTable(restaurantId, req.body || {});
        res.status(201).json({ success: true, message: 'Table created successfully', data: table });
    } catch (error) {
        next(error);
    }
}

// ─── RESTAURANT: Get my tables ───────────────────────────────────────────────
export async function getMyDiningTables(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const tables = await diningService.getMyDiningTables(restaurantId);
        res.status(200).json({ success: true, message: 'Tables fetched successfully', data: tables });
    } catch (error) {
        next(error);
    }
}

// ─── RESTAURANT: Update a table ──────────────────────────────────────────────
export async function updateDiningTable(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid table ID' });
        }

        const table = await diningService.updateDiningTable(restaurantId, id, req.body || {});
        res.status(200).json({ success: true, message: 'Table updated successfully', data: table });
    } catch (error) {
        next(error);
    }
}

// ─── RESTAURANT: Delete (soft) a table ───────────────────────────────────────
export async function deleteDiningTable(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid table ID' });
        }

        const result = await diningService.deleteDiningTable(restaurantId, id);
        res.status(200).json({ success: true, message: result.message, data: result });
    } catch (error) {
        next(error);
    }
}

// ─── PUBLIC: Get available tables for a restaurant/date/slot ─────────────────
export async function getPublicAvailableTables(req, res, next) {
    try {
        const { restaurantId } = req.params;
        const { date, timeSlot } = req.query;

        if (!date || !timeSlot) {
            return res.status(400).json({
                success: false,
                message: 'date and timeSlot query params are required'
            });
        }

        const tables = await diningService.getAvailableTablesForSlot(restaurantId, date, timeSlot);
        res.status(200).json({
            success: true,
            message: 'Table availability fetched successfully',
            data: { tables }
        });
    } catch (error) {
        next(error);
    }
}
