import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { logger } from '../../../../utils/logger.js';

// Side-effect imports so every model below is registered on mongoose.models.
import '../../orders/models/order.model.js';
import '../../orders/models/foodTransaction.model.js';
import '../models/offerUsage.model.js';
import '../models/offer.model.js';
import '../../../../models/Promocode.js';
import '../../../../core/users/user.model.js';
import '../../user/models/userWallet.model.js';
import '../../user/models/supportTicket.model.js';
import '../../loyalty/models/loyaltyPoint.model.js';
import '../models/referralLog.model.js';
import '../models/accountDeletion.model.js';
import '../../restaurant/models/restaurant.model.js';
import '../models/food.model.js';
import '../../restaurant/models/foodAddon.model.js';
import '../../restaurant/models/restaurantMenu.model.js';
import '../../restaurant/models/restaurantWallet.model.js';
import '../../restaurant/models/foodRestaurantWithdrawal.model.js';
import '../../restaurant/models/outletTimings.model.js';
import '../../restaurant/models/supportTicket.model.js';
import '../models/restaurantCommission.model.js';
import '../../subscription/models/restaurantSubscription.model.js';
import '../../delivery/models/deliveryPartner.model.js';
import '../../delivery/models/deliveryWallet.model.js';
import '../../delivery/models/foodDeliveryWithdrawal.model.js';
import '../../delivery/models/foodDeliveryCashDeposit.model.js';
import '../../delivery/models/supportTicket.model.js';
import '../models/deliveryBonusTransaction.model.js';
import '../models/earningAddonHistory.model.js';
import '../models/safetyEmergencyReport.model.js';
import '../models/category.model.js';
import '../../../../core/notifications/models/notification.model.js';
import '../../../../core/notifications/models/notificationBroadcast.model.js';
import '../../../../core/refreshTokens/refreshToken.model.js';
import '../../landing/models/heroBanner.model.js';
import '../../landing/models/diningBanner.model.js';
import '../../landing/models/under250Banner.model.js';
import '../../landing/models/exploreIcon.model.js';
import '../../landing/models/gourmetRestaurant.model.js';
import '../models/appIntroAd.model.js';

/**
 * Sections an admin can wipe from Dev Settings.
 * - `primary`: the main model; its ids are collected before deletion.
 * - `targets`: models cleared with the section. A target with `linkField` only loses
 *   docs whose `linkField` points at a primary id; `filter` narrows a shared collection.
 * Admin accounts, settings, zones and env config are intentionally never listed here.
 */
const SECTIONS = [
    {
        key: 'orders',
        label: 'Orders',
        description: 'All orders, order transactions and offer usage history.',
        warning: 'Restaurant, rider and admin earnings history built from these orders will be gone.',
        targets: [
            { model: 'FoodOrder' },
            { model: 'FoodTransaction' },
            { model: 'FoodOfferUsage' },
        ],
    },
    {
        key: 'customers',
        label: 'Customers (Users)',
        description: 'All customer accounts with their wallets, loyalty points, referrals, support tickets, notifications and login sessions.',
        warning: 'Existing orders will still reference deleted customers. Delete Orders too for a clean slate.',
        primary: 'FoodUser',
        targets: [
            { model: 'FoodUser' },
            { model: 'FoodUserWallet' },
            { model: 'FoodUserLoyaltyPoints' },
            { model: 'FoodLoyaltyTransaction' },
            { model: 'FoodReferralLog' },
            { model: 'FoodSupportTicket' },
            { model: 'AccountDeletion' },
            { model: 'FoodNotification', filter: { ownerType: 'USER' } },
            { model: 'FoodRefreshToken', linkField: 'userId' },
        ],
    },
    {
        key: 'restaurants',
        label: 'Restaurants',
        description: 'All restaurants with their foods, add-ons, menus, wallets, withdrawals, commissions, subscriptions, timings, support tickets, notifications and login sessions.',
        warning: 'Existing orders will still reference deleted restaurants. Delete Orders too for a clean slate.',
        primary: 'FoodRestaurant',
        targets: [
            { model: 'FoodRestaurant' },
            { model: 'FoodItem' },
            { model: 'FoodAddon' },
            { model: 'FoodRestaurantMenu' },
            { model: 'FoodRestaurantWallet' },
            { model: 'FoodRestaurantWithdrawal' },
            { model: 'FoodRestaurantCommission' },
            { model: 'FoodRestaurantSubscription' },
            { model: 'FoodRestaurantOutletTimings' },
            { model: 'FoodRestaurantSupportTicket' },
            { model: 'FoodNotification', filter: { ownerType: 'RESTAURANT' } },
            { model: 'FoodRefreshToken', linkField: 'userId' },
        ],
    },
    {
        key: 'foods',
        label: 'Foods & Add-ons',
        description: 'All food items and add-ons of every restaurant. Restaurants stay.',
        targets: [
            { model: 'FoodItem' },
            { model: 'FoodAddon' },
            { model: 'FoodRestaurantMenu' },
        ],
    },
    {
        key: 'deliveryPartners',
        label: 'Delivery Partners',
        description: 'All riders with their wallets, withdrawals, cash deposits, bonuses, earning history, support tickets, notifications and login sessions.',
        warning: 'Existing orders will still reference deleted riders. Delete Orders too for a clean slate.',
        primary: 'FoodDeliveryPartner',
        targets: [
            { model: 'FoodDeliveryPartner' },
            { model: 'FoodDeliveryWallet' },
            { model: 'FoodDeliveryWithdrawal' },
            { model: 'FoodDeliveryCashDeposit' },
            { model: 'DeliveryBonusTransaction' },
            { model: 'FoodEarningAddonHistory' },
            { model: 'DeliverySupportTicket' },
            { model: 'FoodNotification', filter: { ownerType: 'DELIVERY_PARTNER' } },
            { model: 'FoodRefreshToken', linkField: 'userId' },
        ],
    },
    {
        key: 'supportTickets',
        label: 'Support Tickets & Reports',
        description: 'Customer, restaurant and rider support tickets plus safety emergency reports.',
        targets: [
            { model: 'FoodSupportTicket' },
            { model: 'FoodRestaurantSupportTicket' },
            { model: 'DeliverySupportTicket' },
            { model: 'FoodSafetyEmergencyReport' },
        ],
    },
    {
        key: 'notifications',
        label: 'Notifications',
        description: 'All in-app notifications and admin broadcast history.',
        targets: [
            { model: 'FoodNotification' },
            { model: 'BroadcastNotification' },
        ],
    },
    {
        key: 'offers',
        label: 'Offers & Coupons',
        description: 'All offers, promocodes and their usage history.',
        targets: [
            { model: 'FoodOffer' },
            { model: 'FoodOfferUsage' },
            { model: 'Promocode' },
        ],
    },
    {
        key: 'categories',
        label: 'Food Categories',
        description: 'All food categories (admin and restaurant created).',
        warning: 'Foods keep their category name but lose the category link.',
        targets: [{ model: 'FoodCategory' }],
    },
    {
        key: 'banners',
        label: 'Banners & Landing Content',
        description: 'Hero, dining and under-250 banners, explore icons, gourmet picks and app intro ads.',
        targets: [
            { model: 'FoodHeroBanner' },
            { model: 'FoodDiningBanner' },
            { model: 'FoodUnder250Banner' },
            { model: 'FoodExploreIcon' },
            { model: 'FoodGourmetRestaurant' },
            { model: 'AppIntroAd' },
        ],
    },
];

const getModel = (name) => mongoose.models[name] || null;

const getSection = (key) => {
    const section = SECTIONS.find((s) => s.key === key);
    if (!section) throw new ValidationError('Unknown data section');
    return section;
};

export const getConfirmText = (section) => `DELETE ${section.key.toUpperCase()}`;

async function getPrimaryIds(section) {
    if (!section.primary) return [];
    const model = getModel(section.primary);
    return model ? model.distinct('_id') : [];
}

function buildTargetFilter(target, primaryIds) {
    if (target.linkField) return { [target.linkField]: { $in: primaryIds } };
    return target.filter || {};
}

async function countSection(section) {
    const primaryIds = await getPrimaryIds(section);
    const collections = await Promise.all(
        section.targets.map(async (target) => {
            const model = getModel(target.model);
            const count = model ? await model.countDocuments(buildTargetFilter(target, primaryIds)) : 0;
            return { model: target.model, count };
        }),
    );
    return {
        collections,
        total: collections.reduce((sum, c) => sum + c.count, 0),
    };
}

export async function listDevDataSections() {
    return Promise.all(
        SECTIONS.map(async (section) => ({
            key: section.key,
            label: section.label,
            description: section.description,
            warning: section.warning || '',
            confirmText: getConfirmText(section),
            ...(await countSection(section)),
        })),
    );
}

export async function deleteDevDataSection(key, confirmText, admin = {}) {
    const section = getSection(key);
    if (String(confirmText || '').trim() !== getConfirmText(section)) {
        throw new ValidationError(`Type "${getConfirmText(section)}" to confirm`);
    }

    // Collect linked ids before the primary collection is wiped.
    const primaryIds = await getPrimaryIds(section);
    const results = [];
    for (const target of section.targets) {
        const model = getModel(target.model);
        if (!model) {
            results.push({ model: target.model, deleted: 0, skipped: true });
            continue;
        }
        const { deletedCount } = await model.deleteMany(buildTargetFilter(target, primaryIds));
        results.push({ model: target.model, deleted: deletedCount || 0 });
    }

    const total = results.reduce((sum, r) => sum + r.deleted, 0);
    logger.warn(
        `[DevData] Section "${section.key}" wiped by admin ${admin.userId || 'unknown'} (${admin.role || '-'}): ` +
        results.map((r) => `${r.model}=${r.deleted}`).join(', '),
    );
    return { section: section.key, total, results };
}
