import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodRestaurantWithdrawal } from '../../restaurant/models/foodRestaurantWithdrawal.model.js';
import { FoodRestaurantCommission } from '../models/restaurantCommission.model.js';
import { FoodCategory } from '../models/category.model.js';
import { FoodItem } from '../models/food.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { FoodTransaction } from '../../orders/models/foodTransaction.model.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function parseDayStart(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
}

function parseDayEnd(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d;
}

/**
 * Resolves the report window. An explicit fromDate/toDate wins; otherwise the same
 * "Today / This Week / This Month / This Year" labels the restaurant list report uses.
 * Returns null for "all time".
 */
function resolveDateFilter(query = {}) {
    const from = parseDayStart(query.fromDate || query.startDate);
    const to = parseDayEnd(query.toDate || query.endDate);
    if (from && to) return { $gte: from, $lte: to };

    const label = String(query.time || '').trim().toLowerCase();
    if (!label || label === 'all time') return null;

    const start = new Date();
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    if (label === 'today') {
        start.setHours(0, 0, 0, 0);
    } else if (label === 'this week') {
        const day = start.getDay(); // 0 = Sunday
        start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
        start.setHours(0, 0, 0, 0);
    } else if (label === 'this month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
    } else if (label === 'this year') {
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
    } else {
        return null;
    }

    return { $gte: start, $lte: end };
}

/**
 * Everything the admin needs about ONE restaurant in a single place: profile, commission
 * setup, order counts, the full earning split, every menu item it has added, which of its
 * items actually sold, withdrawals and its recent orders.
 *
 * Note on earnings: `itemSubtotal` is what the customer paid for items and still carries the
 * admin's hidden food markup. `restaurantItemValue` is that same subtotal with the markup
 * removed - it is the restaurant's own menu value, and the base its payout and commission
 * are computed on. `adminMarkup` is the difference and belongs to the platform.
 */
export async function getRestaurantFullReport(restaurantId, query = {}) {
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
        throw new ValidationError('A valid restaurant id is required');
    }
    const rid = new mongoose.Types.ObjectId(restaurantId);

    const restaurant = await FoodRestaurant.findById(rid)
        .populate('zoneId', 'name zoneName')
        .lean();
    if (!restaurant) throw new ValidationError('Restaurant not found');

    const createdAtFilter = resolveDateFilter(query);

    const baseOrderMatch = { restaurantId: rid };
    if (createdAtFilter) baseOrderMatch.createdAt = createdAtFilter;
    const deliveredMatch = { ...baseOrderMatch, orderStatus: 'delivered' };

    const ordersLimit = Math.min(Math.max(parseInt(query.ordersLimit, 10) || 100, 1), 500);

    const [
        statusAgg,
        deliveredAgg,
        menuItems,
        categories,
        soldItemsAgg,
        payoutAgg,
        withdrawalAgg,
        commissionRule,
        recentOrders,
    ] = await Promise.all([
        FoodOrder.aggregate([
            { $match: baseOrderMatch },
            { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
        ]),
        FoodOrder.aggregate([
            { $match: deliveredMatch },
            {
                $group: {
                    _id: null,
                    orders: { $sum: 1 },
                    grossSales: { $sum: { $ifNull: ['$pricing.total', 0] } },
                    itemSubtotal: { $sum: { $ifNull: ['$pricing.subtotal', 0] } },
                    markup: { $sum: { $ifNull: ['$pricing.markupAmount', 0] } },
                    packagingFee: { $sum: { $ifNull: ['$pricing.packagingFee', 0] } },
                    deliveryFee: { $sum: { $ifNull: ['$pricing.deliveryFee', 0] } },
                    platformFee: { $sum: { $ifNull: ['$pricing.platformFee', 0] } },
                    tax: { $sum: { $ifNull: ['$pricing.tax', 0] } },
                    discount: { $sum: { $ifNull: ['$pricing.discount', 0] } },
                    pointsDiscount: { $sum: { $ifNull: ['$pricing.pointsDiscount', 0] } },
                    adminCommission: { $sum: { $ifNull: ['$pricing.restaurantCommission', 0] } },
                    gstOnItem: { $sum: { $ifNull: ['$pricing.gstOnItem', 0] } },
                    gstOnCommission: { $sum: { $ifNull: ['$pricing.gstOnCommission', 0] } },
                    paymentGatewayFee: { $sum: { $ifNull: ['$pricing.paymentGatewayFee', 0] } },
                    tcs: { $sum: { $ifNull: ['$pricing.tcs', 0] } },
                    platformProfit: { $sum: { $ifNull: ['$platformProfit', 0] } },
                    riderEarning: { $sum: { $ifNull: ['$riderEarning', 0] } },
                },
            },
        ]),
        FoodItem.find({ restaurantId: rid })
            .select(
                'name description price variants image foodType isAvailable approvalStatus categoryId categoryName createdAt'
            )
            .sort({ createdAt: -1 })
            .lean(),
        FoodCategory.find({ restaurantId: rid }).select('name').lean(),
        FoodOrder.aggregate([
            { $match: deliveredMatch },
            { $unwind: '$items' },
            {
                $group: {
                    _id: { $ifNull: ['$items.name', 'Unnamed item'] },
                    quantity: { $sum: { $ifNull: ['$items.quantity', 0] } },
                    revenue: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ['$items.price', 0] },
                                { $ifNull: ['$items.quantity', 0] },
                            ],
                        },
                    },
                    orders: { $sum: 1 },
                },
            },
            { $sort: { quantity: -1 } },
        ]),
        FoodTransaction.aggregate([
            {
                $match: {
                    restaurantId: rid,
                    status: { $in: ['captured', 'authorized'] },
                    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
                },
            },
            {
                $lookup: {
                    from: 'food_orders',
                    localField: 'orderId',
                    foreignField: '_id',
                    as: 'order',
                },
            },
            { $unwind: '$order' },
            { $match: { 'order.orderStatus': 'delivered' } },
            {
                $group: {
                    _id: null,
                    restaurantPayout: { $sum: { $ifNull: ['$amounts.restaurantShare', 0] } },
                    markup: { $sum: { $ifNull: ['$amounts.markupAmount', 0] } },
                    settled: {
                        $sum: {
                            $cond: [
                                { $eq: ['$settlement.isRestaurantSettled', true] },
                                { $ifNull: ['$amounts.restaurantShare', 0] },
                                0,
                            ],
                        },
                    },
                },
            },
        ]),
        FoodRestaurantWithdrawal.aggregate([
            { $match: { restaurantId: rid } },
            {
                $group: {
                    _id: { $toLower: { $ifNull: ['$status', 'pending'] } },
                    total: { $sum: { $ifNull: ['$amount', 0] } },
                    count: { $sum: 1 },
                },
            },
        ]),
        FoodRestaurantCommission.findOne({ restaurantId: rid }).lean(),
        FoodOrder.find(baseOrderMatch)
            .select('orderId orderStatus pricing platformProfit payment.method createdAt items')
            .sort({ createdAt: -1 })
            .limit(ordersLimit)
            .lean(),
    ]);

    const statusCounts = {};
    (statusAgg || []).forEach((row) => {
        statusCounts[String(row._id || 'unknown')] = Number(row.count || 0);
    });
    const totalOrders = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
    const cancelledOrders = Object.entries(statusCounts)
        .filter(([status]) => String(status).startsWith('cancelled') || status === 'dead')
        .reduce((sum, [, n]) => sum + n, 0);

    const delivered = deliveredAgg?.[0] || {};
    const payouts = payoutAgg?.[0] || {};

    const itemSubtotal = round2(delivered.itemSubtotal);
    const adminMarkup = round2(delivered.markup ?? payouts.markup);
    const restaurantItemValue = round2(itemSubtotal - adminMarkup);

    const withdrawals = { pending: 0, approved: 0, processed: 0, rejected: 0, total: 0 };
    (withdrawalAgg || []).forEach((row) => {
        const key = String(row._id || 'pending');
        const amount = Number(row.total || 0);
        if (key in withdrawals) withdrawals[key] += amount;
        if (key !== 'rejected') withdrawals.total += amount;
    });

    const categoryNameById = new Map(
        (categories || []).map((c) => [String(c._id), c.name || ''])
    );
    const soldByName = new Map(
        (soldItemsAgg || []).map((row) => [String(row._id || '').toLowerCase(), row])
    );

    const menu = (menuItems || []).map((item, index) => {
        const sold = soldByName.get(String(item.name || '').toLowerCase());
        return {
            sl: index + 1,
            itemId: item._id,
            name: item.name || '',
            description: item.description || '',
            category:
                item.categoryName || categoryNameById.get(String(item.categoryId || '')) || '',
            price: Number(item.price || 0),
            variants: (item.variants || []).map((v) => ({
                name: v.name,
                price: Number(v.price || 0),
            })),
            foodType: item.foodType || '',
            isAvailable: item.isAvailable !== false,
            approvalStatus: item.approvalStatus || 'approved',
            image: item.image || '',
            addedOn: item.createdAt,
            quantitySold: Number(sold?.quantity || 0),
            revenue: round2(sold?.revenue || 0),
        };
    });

    const menuNames = new Set(menu.map((m) => String(m.name).toLowerCase()));
    const orderedItems = (soldItemsAgg || []).map((row, index) => ({
        sl: index + 1,
        name: String(row._id || 'Unnamed item'),
        quantitySold: Number(row.quantity || 0),
        revenue: round2(row.revenue),
        orders: Number(row.orders || 0),
        stillOnMenu: menuNames.has(String(row._id || '').toLowerCase()),
    }));

    const address =
        restaurant?.location?.formattedAddress ||
        [
            restaurant.addressLine1,
            restaurant.addressLine2,
            restaurant.area,
            restaurant.city,
            restaurant.state,
            restaurant.pincode,
        ]
            .filter(Boolean)
            .join(', ');

    return {
        restaurant: {
            id: restaurant._id,
            name: restaurant.restaurantName || '',
            logo: restaurant.profileImage || '',
            ownerName: restaurant.ownerName || '',
            ownerPhone: restaurant.ownerPhone || restaurant.primaryContactNumber || '',
            ownerEmail: restaurant.ownerEmail || restaurant.email || '',
            address,
            zone: restaurant.zoneId?.name || restaurant.zoneId?.zoneName || '',
            status: restaurant.status || 'pending',
            isActive: restaurant.isActive !== false,
            isAcceptingOrders: restaurant.isAcceptingOrders !== false,
            cuisines: restaurant.cuisines || [],
            fssaiNumber: restaurant.fssai?.number || restaurant.fssaiNumber || '',
            gstNumber: restaurant.gstNumber || '',
            joinedOn: restaurant.createdAt,
            rating: Number(restaurant.rating || 0),
            totalRatings: Number(restaurant.totalRatings || 0),
        },
        period: {
            from: createdAtFilter?.$gte || null,
            to: createdAtFilter?.$lte || null,
            label: createdAtFilter ? query.time || 'Custom range' : 'All Time',
        },
        commissionSetup: {
            type: commissionRule?.defaultCommission?.type || 'percentage',
            value: Number(commissionRule?.defaultCommission?.value ?? 0),
            isCustom: Boolean(commissionRule),
            status: commissionRule ? commissionRule.status !== false : null,
        },
        orders: {
            total: totalOrders,
            delivered: Number(statusCounts.delivered || 0),
            cancelled: cancelledOrders,
            byStatus: statusCounts,
        },
        earnings: {
            // What customers paid
            grossSales: round2(delivered.grossSales),
            itemSubtotal,
            // The restaurant's own menu value, i.e. the base it is paid and charged on
            restaurantItemValue,
            adminMarkup,
            packagingFee: round2(delivered.packagingFee),
            deliveryFee: round2(delivered.deliveryFee),
            platformFee: round2(delivered.platformFee),
            tax: round2(delivered.tax),
            discountGiven: round2(
                Number(delivered.discount || 0) + Number(delivered.pointsDiscount || 0)
            ),
            // What the admin keeps
            adminCommission: round2(delivered.adminCommission),
            gstOnItem: round2(delivered.gstOnItem),
            gstOnCommission: round2(delivered.gstOnCommission),
            paymentGatewayFee: round2(delivered.paymentGatewayFee),
            tcs: round2(delivered.tcs),
            adminNetProfit: round2(delivered.platformProfit),
            riderPayout: round2(delivered.riderEarning),
            // What the restaurant takes home
            restaurantPayout: round2(payouts.restaurantPayout),
            settledPayout: round2(payouts.settled),
            unsettledPayout: round2(
                Number(payouts.restaurantPayout || 0) - Number(payouts.settled || 0)
            ),
            averageOrderValue:
                Number(delivered.orders || 0) > 0
                    ? round2(Number(delivered.grossSales || 0) / Number(delivered.orders))
                    : 0,
        },
        withdrawals,
        menu: {
            total: menu.length,
            available: menu.filter((m) => m.isAvailable).length,
            pendingApproval: menu.filter((m) => m.approvalStatus === 'pending').length,
            items: menu,
        },
        orderedItems: {
            distinctItems: orderedItems.length,
            totalQuantity: orderedItems.reduce((sum, i) => sum + i.quantitySold, 0),
            items: orderedItems,
        },
        recentOrders: (recentOrders || []).map((o) => ({
            orderId: o.orderId || String(o._id),
            status: o.orderStatus,
            total: Number(o.pricing?.total || 0),
            subtotal: Number(o.pricing?.subtotal || 0),
            markup: Number(o.pricing?.markupAmount || 0),
            adminCommission: Number(o.pricing?.restaurantCommission || 0),
            tax: Number(o.pricing?.tax || 0),
            discount: Number(o.pricing?.discount || 0),
            paymentMethod: o.payment?.method || '',
            itemCount: Array.isArray(o.items) ? o.items.length : 0,
            items: (o.items || []).map((i) => `${i.quantity}x ${i.name}`).join(', '),
            createdAt: o.createdAt,
        })),
    };
}

export default getRestaurantFullReport;
