import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { FoodZone } from '../../admin/models/zone.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodSubscriptionPackage } from '../models/subscriptionPackage.model.js';
import { FoodRestaurantSubscription } from '../models/restaurantSubscription.model.js';
import { FoodZoneSubscriptionSetting } from '../models/zoneSubscriptionSetting.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const toObjectId = (value) => {
    const raw = String(value || '').trim();
    return mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : null;
};

const requireObjectId = (value, label) => {
    const id = toObjectId(value);
    if (!id) throw new ValidationError(`Invalid ${label}`);
    return id;
};

const toNumber = (value, label, { min = 0, max = Infinity, integer = false } = {}) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) {
        throw new ValidationError(
            max === Infinity ? `${label} must be a number, ${min} or more` : `${label} must be a number between ${min} and ${max}`
        );
    }
    return integer ? Math.round(n) : n;
};

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const zoneLabel = (zone) => zone?.name || zone?.zoneName || '';

// ---------- Zone on/off ----------

const getDisabledZoneIds = async () => {
    const disabled = await FoodZoneSubscriptionSetting.find({ enabled: false }).select('zoneId').lean();
    return new Set(disabled.map((d) => String(d.zoneId)));
};

export const isZoneSubscriptionEnabled = async (zoneId) => {
    if (!zoneId) return true;
    const setting = await FoodZoneSubscriptionSetting.findOne({ zoneId }).select('enabled').lean();
    return setting?.enabled !== false;
};

export async function listZoneSubscriptionSettings() {
    const [zones, disabledIds, restaurantCounts] = await Promise.all([
        FoodZone.find({}).select('name zoneName isActive').sort({ name: 1 }).lean(),
        getDisabledZoneIds(),
        FoodRestaurant.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: '$zoneId', count: { $sum: 1 } } }
        ])
    ]);
    const countMap = new Map(restaurantCounts.map((c) => [String(c._id), c.count]));

    return zones.map((zone) => ({
        zoneId: String(zone._id),
        name: zoneLabel(zone),
        isZoneActive: zone.isActive !== false,
        subscriptionEnabled: !disabledIds.has(String(zone._id)),
        restaurantCount: countMap.get(String(zone._id)) || 0
    }));
}

export async function setZoneSubscriptionEnabled(zoneIdRaw, enabled, adminId) {
    const zoneId = requireObjectId(zoneIdRaw, 'zone id');
    const zone = await FoodZone.findById(zoneId).select('_id').lean();
    if (!zone) throw new NotFoundError('Zone not found');

    await FoodZoneSubscriptionSetting.findOneAndUpdate(
        { zoneId },
        { $set: { enabled: Boolean(enabled), updatedBy: toObjectId(adminId) } },
        { upsert: true, new: true }
    );
    return { zoneId: String(zoneId), subscriptionEnabled: Boolean(enabled) };
}

// ---------- Packages ----------

export const getPackagePriceForZone = (pkg, zoneId) => {
    if (zoneId) {
        const override = (pkg?.zonePrices || []).find((zp) => String(zp.zoneId) === String(zoneId));
        if (override && Number.isFinite(Number(override.price))) return Number(override.price);
    }
    return Number(pkg?.price || 0);
};

const normalizeFeatures = (value) => {
    if (Array.isArray(value)) return value.map((f) => String(f || '').trim()).filter(Boolean);
    return String(value || '').split(',').map((f) => f.trim()).filter(Boolean);
};

const normalizeZonePrices = async (value) => {
    if (!Array.isArray(value)) throw new ValidationError('zonePrices must be a list');
    const seen = new Set();
    const result = [];
    for (const entry of value) {
        // Empty price means "use default price" for that zone, so skip it.
        if (entry?.price === '' || entry?.price === null || entry?.price === undefined) continue;
        const zoneId = requireObjectId(entry?.zoneId, 'zone id in zone prices');
        if (seen.has(String(zoneId))) continue;
        seen.add(String(zoneId));
        result.push({ zoneId, price: toNumber(entry.price, 'Zone price') });
    }
    if (result.length) {
        const found = await FoodZone.countDocuments({ _id: { $in: result.map((r) => r.zoneId) } });
        if (found !== result.length) throw new ValidationError('One or more zones in zone prices do not exist');
    }
    return result;
};

const buildPackageUpdate = async (body = {}, { partial = false } = {}) => {
    const update = {};
    if (!partial || body.name !== undefined) {
        const name = String(body.name || '').trim();
        if (!name) throw new ValidationError('Package name is required');
        update.name = name.slice(0, 120);
    }
    if (!partial || body.price !== undefined) update.price = toNumber(body.price, 'Price');
    if (!partial || body.durationDays !== undefined) {
        update.durationDays = toNumber(body.durationDays, 'Validity (days)', { min: 1, max: 3650, integer: true });
    }
    if (body.description !== undefined) update.description = String(body.description || '').trim().slice(0, 500);
    if (body.maxFoods !== undefined) update.maxFoods = toNumber(body.maxFoods || 0, 'Max foods', { integer: true });
    if (body.maxOrders !== undefined) update.maxOrders = toNumber(body.maxOrders || 0, 'Max orders', { integer: true });
    if (body.commissionRate !== undefined) {
        update.commissionRate = toNumber(body.commissionRate || 0, 'Commission %', { max: 100 });
    }
    if (body.features !== undefined) update.features = normalizeFeatures(body.features);
    if (body.zonePrices !== undefined) update.zonePrices = await normalizeZonePrices(body.zonePrices);
    if (body.isActive !== undefined) update.isActive = Boolean(body.isActive);
    if (body.sortOrder !== undefined) update.sortOrder = toNumber(body.sortOrder || 0, 'Sort order', { min: -100000 });
    return update;
};

const serializePackage = (pkg, zoneId = null) => ({
    ...pkg,
    _id: String(pkg._id),
    zonePrices: (pkg.zonePrices || []).map((zp) => ({ zoneId: String(zp.zoneId), price: zp.price })),
    ...(zoneId ? { zonePrice: getPackagePriceForZone(pkg, zoneId) } : {})
});

export async function listPackages({ includeInactive = true } = {}) {
    const filter = includeInactive ? {} : { isActive: true };
    const packages = await FoodSubscriptionPackage.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();
    return packages.map((pkg) => serializePackage(pkg));
}

export async function createPackage(body) {
    const doc = await FoodSubscriptionPackage.create(await buildPackageUpdate(body));
    return serializePackage(doc.toObject());
}

export async function updatePackage(idRaw, body) {
    const id = requireObjectId(idRaw, 'package id');
    const update = await buildPackageUpdate(body, { partial: true });
    const doc = await FoodSubscriptionPackage.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean();
    if (!doc) throw new NotFoundError('Package not found');
    return serializePackage(doc);
}

export async function deletePackage(idRaw) {
    const id = requireObjectId(idRaw, 'package id');
    await expireDueSubscriptions();
    const inUse = await FoodRestaurantSubscription.countDocuments({ packageId: id, isCurrent: true, status: 'active' });
    if (inUse > 0) {
        throw new ValidationError(`This package is active for ${inUse} restaurant(s). Turn the package off instead of deleting it.`);
    }
    const doc = await FoodSubscriptionPackage.findByIdAndDelete(id).lean();
    if (!doc) throw new NotFoundError('Package not found');
    return { deleted: true };
}

// ---------- Restaurant subscriptions ----------

// Marks active subscriptions whose end date has passed as expired.
export async function expireDueSubscriptions() {
    await FoodRestaurantSubscription.updateMany(
        { status: 'active', endDate: { $lt: new Date() } },
        { $set: { status: 'expired' } }
    );
}

const serializeSubscription = (sub) => {
    if (!sub) return null;
    const now = Date.now();
    const endMs = new Date(sub.endDate).getTime();
    const status = sub.status === 'active' && endMs < now ? 'expired' : sub.status;
    return {
        _id: String(sub._id),
        restaurantId: String(sub.restaurantId),
        zoneId: sub.zoneId ? String(sub.zoneId) : null,
        packageId: String(sub.packageId),
        packageName: sub.packageName,
        price: sub.price,
        durationDays: sub.durationDays,
        maxFoods: sub.maxFoods,
        maxOrders: sub.maxOrders,
        commissionRate: sub.commissionRate,
        features: sub.features || [],
        startDate: sub.startDate,
        endDate: sub.endDate,
        status,
        daysLeft: status === 'active' ? Math.max(0, Math.ceil((endMs - now) / DAY_MS)) : 0,
        notes: sub.notes || '',
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt
    };
};

export async function listRestaurantSubscriptions(query = {}) {
    await expireDueSubscriptions();

    const restaurantFilter = { status: 'approved' };
    const zoneIdRaw = String(query.zoneId || '').trim();
    if (zoneIdRaw && zoneIdRaw !== 'all') {
        restaurantFilter.zoneId = zoneIdRaw === 'none' ? null : requireObjectId(zoneIdRaw, 'zone id');
    }
    const search = String(query.search || '').trim();
    if (search) {
        const term = escapeRegex(search.slice(0, 80));
        restaurantFilter.$or = [
            { restaurantName: { $regex: term, $options: 'i' } },
            { ownerName: { $regex: term, $options: 'i' } },
            { ownerPhone: { $regex: term, $options: 'i' } }
        ];
    }

    const [restaurants, zones, disabledIds] = await Promise.all([
        FoodRestaurant.find(restaurantFilter)
            .select('restaurantName ownerName ownerPhone zoneId profileImage')
            .sort({ restaurantName: 1 })
            .lean(),
        FoodZone.find({}).select('name zoneName').lean(),
        getDisabledZoneIds()
    ]);
    const zoneMap = new Map(zones.map((z) => [String(z._id), zoneLabel(z)]));

    const subs = await FoodRestaurantSubscription.find({
        restaurantId: { $in: restaurants.map((r) => r._id) },
        isCurrent: true
    }).lean();
    const subMap = new Map(subs.map((s) => [String(s.restaurantId), serializeSubscription(s)]));

    const rows = restaurants.map((r) => {
        const zoneId = r.zoneId ? String(r.zoneId) : null;
        return {
            restaurantId: String(r._id),
            restaurantName: r.restaurantName || '',
            ownerName: r.ownerName || '',
            ownerPhone: r.ownerPhone || '',
            profileImage: r.profileImage || '',
            zoneId,
            zoneName: zoneId ? zoneMap.get(zoneId) || '' : '',
            zoneSubscriptionEnabled: zoneId ? !disabledIds.has(zoneId) : true,
            subscription: subMap.get(String(r._id)) || null
        };
    });

    const stats = { total: rows.length, active: 0, inactive: 0, expired: 0, none: 0, activeValue: 0 };
    for (const row of rows) {
        const status = row.subscription?.status;
        if (status === 'active') {
            stats.active += 1;
            stats.activeValue += Number(row.subscription.price || 0);
        } else if (status === 'inactive') stats.inactive += 1;
        else if (status === 'expired') stats.expired += 1;
        else stats.none += 1;
    }

    const statusFilter = String(query.status || 'all');
    const filtered = statusFilter === 'all'
        ? rows
        : rows.filter((row) => (statusFilter === 'none' ? !row.subscription : row.subscription?.status === statusFilter));

    return { restaurants: filtered, stats };
}

const getRestaurantOrThrow = async (restaurantIdRaw) => {
    const restaurantId = requireObjectId(restaurantIdRaw, 'restaurant id');
    const restaurant = await FoodRestaurant.findById(restaurantId).select('restaurantName zoneId status').lean();
    if (!restaurant) throw new NotFoundError('Restaurant not found');
    return restaurant;
};

export async function assignSubscription(restaurantIdRaw, body = {}, adminId = null) {
    const restaurant = await getRestaurantOrThrow(restaurantIdRaw);
    const zoneId = restaurant.zoneId || null;
    if (!(await isZoneSubscriptionEnabled(zoneId))) {
        throw new ValidationError('Subscription is turned off for this restaurant\'s zone');
    }

    const packageId = requireObjectId(body.packageId, 'package id');
    const pkg = await FoodSubscriptionPackage.findById(packageId).lean();
    if (!pkg) throw new NotFoundError('Package not found');
    if (!pkg.isActive) throw new ValidationError('This package is turned off');

    const durationDays = body.durationDays !== undefined && body.durationDays !== ''
        ? toNumber(body.durationDays, 'Duration (days)', { min: 1, max: 3650, integer: true })
        : pkg.durationDays;
    const price = body.price !== undefined && body.price !== ''
        ? toNumber(body.price, 'Subscription fee')
        : getPackagePriceForZone(pkg, zoneId);

    await expireDueSubscriptions();
    const current = await FoodRestaurantSubscription.findOne({ restaurantId: restaurant._id, isCurrent: true }).lean();

    // Renewing the same active plan extends it from its current end date instead of losing the remaining days.
    const now = new Date();
    const extendsCurrent = current?.status === 'active' && String(current.packageId) === String(pkg._id);
    const baseDate = extendsCurrent && new Date(current.endDate) > now ? new Date(current.endDate) : now;
    const endDate = new Date(baseDate.getTime() + durationDays * DAY_MS);

    if (current) {
        await FoodRestaurantSubscription.updateOne(
            { _id: current._id },
            { $set: { isCurrent: false, ...(current.status === 'active' ? { status: 'replaced' } : {}) } }
        );
    }

    const created = await FoodRestaurantSubscription.create({
        restaurantId: restaurant._id,
        zoneId,
        packageId: pkg._id,
        packageName: pkg.name,
        price,
        durationDays,
        maxFoods: pkg.maxFoods,
        maxOrders: pkg.maxOrders,
        commissionRate: pkg.commissionRate,
        features: pkg.features || [],
        startDate: extendsCurrent ? current.startDate : now,
        endDate,
        status: 'active',
        isCurrent: true,
        notes: String(body.notes || '').trim().slice(0, 500),
        assignedBy: toObjectId(adminId)
    });

    return serializeSubscription(created.toObject());
}

export async function setSubscriptionStatus(restaurantIdRaw, statusRaw) {
    const status = String(statusRaw || '').trim();
    if (!['active', 'inactive'].includes(status)) throw new ValidationError('Status must be active or inactive');

    const restaurant = await getRestaurantOrThrow(restaurantIdRaw);
    await expireDueSubscriptions();
    const current = await FoodRestaurantSubscription.findOne({ restaurantId: restaurant._id, isCurrent: true }).lean();
    if (!current) throw new ValidationError('No subscription assigned to this restaurant yet');
    if (current.status === 'expired') throw new ValidationError('This subscription has expired. Renew it to activate again.');
    if (status === 'active' && !(await isZoneSubscriptionEnabled(restaurant.zoneId))) {
        throw new ValidationError('Subscription is turned off for this restaurant\'s zone');
    }

    const doc = await FoodRestaurantSubscription.findByIdAndUpdate(current._id, { $set: { status } }, { new: true }).lean();
    return serializeSubscription(doc);
}

export async function getRestaurantSubscriptionHistory(restaurantIdRaw) {
    const restaurant = await getRestaurantOrThrow(restaurantIdRaw);
    await expireDueSubscriptions();
    const list = await FoodRestaurantSubscription.find({ restaurantId: restaurant._id }).sort({ createdAt: -1 }).limit(50).lean();
    return list.map(serializeSubscription);
}

// ---------- Restaurant panel ----------

export async function getMySubscription(restaurantIdRaw) {
    const restaurant = await getRestaurantOrThrow(restaurantIdRaw);
    const zoneId = restaurant.zoneId || null;
    const [enabled, zone] = await Promise.all([
        isZoneSubscriptionEnabled(zoneId),
        zoneId ? FoodZone.findById(zoneId).select('name zoneName').lean() : null
    ]);
    const zoneInfo = { zoneId: zoneId ? String(zoneId) : null, zoneName: zoneLabel(zone) };

    if (!enabled) {
        return { enabled: false, ...zoneInfo, subscription: null, packages: [] };
    }

    await expireDueSubscriptions();
    const [current, packages] = await Promise.all([
        FoodRestaurantSubscription.findOne({ restaurantId: restaurant._id, isCurrent: true }).lean(),
        FoodSubscriptionPackage.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean()
    ]);

    return {
        enabled: true,
        ...zoneInfo,
        subscription: serializeSubscription(current),
        // Restaurants only see the price for their own zone.
        packages: packages.map((pkg) => ({
            _id: String(pkg._id),
            name: pkg.name,
            description: pkg.description || '',
            price: getPackagePriceForZone(pkg, zoneId),
            durationDays: pkg.durationDays,
            maxFoods: pkg.maxFoods,
            maxOrders: pkg.maxOrders,
            commissionRate: pkg.commissionRate,
            features: pkg.features || []
        }))
    };
}
