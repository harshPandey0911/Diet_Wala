import mongoose from 'mongoose';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { BroadcastNotification } from '../../../../core/notifications/models/notificationBroadcast.model.js';
import { FoodNotification } from '../../../../core/notifications/models/notification.model.js';
import { createInboxNotifications } from '../../../../core/notifications/notification.service.js';
import { notifyOwnersSafely } from '../../../../core/notifications/firebase.service.js';
import { sendVoipPushNotification } from '../../../../core/notifications/voip.service.js';
import { getIO, rooms } from '../../../../config/socket.js';
import { logger } from '../../../../utils/logger.js';
import { addNotificationJob } from '../../../../queues/producers/notification.producer.js';
import { getNotificationQueue } from '../../../../queues/index.js';

const TARGET_TYPE_MAP = {
    ALL: 'ALL',
    USER: 'USER',
    RESTAURANT: 'RESTAURANT',
    DELIVERY: 'DELIVERY',
    CUSTOM: 'CUSTOM'
};

const OWNER_LABEL_MAP = {
    ALL: 'Everyone',
    USER: 'Users',
    RESTAURANT: 'Restaurants',
    DELIVERY: 'Delivery Partners',
    DELIVERY_PARTNER: 'Delivery Partners'
};

const toObjectId = (value, fieldName) => {
    if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
        throw new ValidationError(`${fieldName} is invalid`);
    }
    return new mongoose.Types.ObjectId(String(value));
};

const normalizeText = (value, fieldName, required = true) => {
    const text = String(value || '').trim();
    if (required && !text) {
        throw new ValidationError(`${fieldName} is required`);
    }
    return text;
};

const normalizeImageUrl = (value) => {
    const url = String(value || '').trim();
    if (!url) return '';
    if (!/^https:\/\//i.test(url)) {
        throw new ValidationError('Image must be an https:// URL');
    }
    return url.slice(0, 1000);
};

const normalizeVoipTokens = (value) =>
    [...new Set(
        String(value || '')
            .split(',')
            .map((token) => token.trim())
            .filter(Boolean)
    )];

const normalizeTargetType = (value) => {
    const nextValue = String(value || '').trim().toUpperCase();
    const normalized = TARGET_TYPE_MAP[nextValue];
    if (!normalized) {
        throw new ValidationError('targetType is invalid');
    }
    return normalized;
};

const ownerModelMap = {
    USER: FoodUser,
    RESTAURANT: FoodRestaurant,
    DELIVERY_PARTNER: FoodDeliveryPartner
};

const buildUserLabel = (doc) => ({
    label: String(doc?.name || doc?.phone || 'User').trim(),
    subLabel: [doc?.phone, doc?.email].filter(Boolean).join(' • ')
});

const buildRestaurantLabel = (doc) => ({
    label: String(doc?.restaurantName || doc?.ownerName || 'Restaurant').trim(),
    subLabel: [doc?.ownerPhone, doc?.ownerEmail].filter(Boolean).join(' • ')
});

const buildDeliveryLabel = (doc) => ({
    label: String(doc?.name || doc?.phone || 'Delivery Partner').trim(),
    subLabel: [doc?.phone, doc?.email].filter(Boolean).join(' • ')
});

const modelConfigMap = {
    USER: {
        model: FoodUser,
        query: { isActive: true },
        select: '_id name phone email',
        buildLabel: buildUserLabel
    },
    RESTAURANT: {
        model: FoodRestaurant,
        query: { status: 'approved' },
        select: '_id restaurantName ownerName ownerPhone ownerEmail',
        buildLabel: buildRestaurantLabel
    },
    DELIVERY_PARTNER: {
        model: FoodDeliveryPartner,
        query: { status: 'approved' },
        select: '_id name phone email',
        buildLabel: buildDeliveryLabel
    }
};

const dedupeTargets = (targets = []) => {
    const map = new Map();
    for (const target of Array.isArray(targets) ? targets : []) {
        const ownerType = String(target?.ownerType || '').trim().toUpperCase();
        const ownerId = String(target?.ownerId || '').trim();
        if (!ownerType || !ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) continue;
        map.set(`${ownerType}:${ownerId}`, {
            ownerType,
            ownerId,
            label: String(target?.label || '').trim(),
            subLabel: String(target?.subLabel || '').trim()
        });
    }
    return [...map.values()];
};

const loadTargetsByOwnerType = async (ownerType) => {
    const config = modelConfigMap[ownerType];
    if (!config) return [];

    const rows = await config.model.find(config.query).select(config.select).lean();
    return rows.map((row) => ({
        ownerType,
        ownerId: String(row._id),
        ...config.buildLabel(row)
    }));
};

const resolveCustomTargets = async ({ targets = [], targetIds = [] } = {}) => {
    const explicitTargets = dedupeTargets(targets);
    if (explicitTargets.length > 0) return explicitTargets;

    const ids = [...new Set((Array.isArray(targetIds) ? targetIds : []).map((value) => String(value || '').trim()).filter(Boolean))];
    if (!ids.length) {
        throw new ValidationError('Please select at least one recipient for custom broadcast');
    }

    const users = await FoodUser.find({ _id: { $in: ids }, isActive: true }).select('_id name phone email').lean();
    return users.map((row) => ({
        ownerType: 'USER',
        ownerId: String(row._id),
        ...buildUserLabel(row)
    }));
};

const resolveTargets = async ({ targetType, targetIds = [], targets = [] } = {}) => {
    if (targetType === 'ALL') {
        const [users, restaurants, deliveryPartners] = await Promise.all([
            loadTargetsByOwnerType('USER'),
            loadTargetsByOwnerType('RESTAURANT'),
            loadTargetsByOwnerType('DELIVERY_PARTNER')
        ]);
        return [...users, ...restaurants, ...deliveryPartners];
    }

    if (targetType === 'USER') return loadTargetsByOwnerType('USER');
    if (targetType === 'RESTAURANT') return loadTargetsByOwnerType('RESTAURANT');
    if (targetType === 'DELIVERY') return loadTargetsByOwnerType('DELIVERY_PARTNER');
    if (targetType === 'CUSTOM') return resolveCustomTargets({ targets, targetIds });

    throw new ValidationError('Unsupported targetType');
};

const buildNotificationPayload = ({ title, message, link, image, broadcastId, target }) => ({
    ownerType: target.ownerType,
    ownerId: target.ownerId,
    title,
    message,
    link,
    category: 'broadcast',
    broadcastId,
    metadata: {
        broadcastId: String(broadcastId),
        image: image || '',
        ownerLabel: target.label || '',
        ownerSubLabel: target.subLabel || ''
    }
});

const buildPushPayload = ({ title, message, link, image, broadcastId }) => ({
    title,
    body: message,
    data: {
        type: 'admin_broadcast',
        broadcastId: String(broadcastId),
        link,
        // firebase.service reads data.image for the big picture in the notification
        ...(image ? { image } : {})
    }
});

const PUSH_TOKEN_QUERY = { $or: [{ 'fcmTokens.0': { $exists: true } }, { 'fcmTokenMobile.0': { $exists: true } }] };

// How many of the recipients have at least one device registered for push.
const countPushReachable = async (targets = []) => {
    const idsByType = new Map();
    for (const target of targets) {
        if (!idsByType.has(target.ownerType)) idsByType.set(target.ownerType, []);
        idsByType.get(target.ownerType).push(target.ownerId);
    }
    let reachable = 0;
    for (const [ownerType, ids] of idsByType) {
        const model = ownerModelMap[ownerType];
        if (!model) continue;
        reachable += await model.countDocuments({ _id: { $in: ids }, ...PUSH_TOKEN_QUERY });
    }
    return reachable;
};

const emitRealtimeNotifications = (targets = [], broadcast) => {
    const io = getIO();
    if (!io) return;

    for (const target of targets) {
        const ownerId = String(target.ownerId || '');
        if (!ownerId) continue;

        const payload = {
            id: String(broadcast._id),
            title: broadcast.title,
            message: broadcast.message,
            link: broadcast.link || '',
            targetType: broadcast.targetType,
            createdAt: broadcast.createdAt
        };

        if (target.ownerType === 'USER') {
            io.to(rooms.user(ownerId)).emit('admin_notification', payload);
        }
        if (target.ownerType === 'RESTAURANT') {
            io.to(rooms.restaurant(ownerId)).emit('admin_notification', payload);
        }
        if (target.ownerType === 'DELIVERY_PARTNER') {
            io.to(rooms.delivery(ownerId)).emit('admin_notification', payload);
        }
    }
};

const paginationMeta = ({ page = 1, limit = 10 } = {}) => {
    const nextPage = Math.max(1, Number(page) || 1);
    const nextLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    return {
        page: nextPage,
        limit: nextLimit,
        skip: (nextPage - 1) * nextLimit
    };
};

const deliverBroadcastNotificationsNow = async ({ targets = [], voipTokens = [], pushPayload = {} } = {}) => {
    const [pushResults, voipResult] = await Promise.all([
        notifyOwnersSafely(targets, pushPayload),
        voipTokens.length > 0
            ? sendVoipPushNotification(
                voipTokens,
                {
                    title: pushPayload.title,
                    body: pushPayload.body,
                    sound: 'default',
                    type: pushPayload?.data?.type || 'admin_broadcast',
                    data: pushPayload.data || {}
                },
                { ownerType: 'RESTAURANT' }
            )
            : Promise.resolve(null)
    ]);

    return { pushResults, voipResult };
};

const enqueueBroadcastDelivery = async ({ broadcast, resolvedTargets = [], voipTokens = [], pushPayload = {} } = {}) => {
    const jobPayload = {
        type: 'admin-broadcast-delivery',
        broadcastId: String(broadcast?._id || ''),
        targets: resolvedTargets.map((target) => ({
            ownerType: target.ownerType,
            ownerId: target.ownerId
        })),
        voipTokens,
        payload: pushPayload
    };

    let hasQueueWorker = false;
    try {
        const queue = getNotificationQueue();
        hasQueueWorker = queue ? (await queue.getWorkersCount()) > 0 : false;
    } catch (error) {
        logger.warn(`Could not check notification workers: ${error.message}`);
    }

    // Only use the queue when a notification worker is actually running; without one the job
    // would wait in Redis and the push would never be sent.
    if (hasQueueWorker) try {
        const job = await addNotificationJob(jobPayload, {
            jobId: `admin-broadcast:${String(broadcast?._id || Date.now())}`
        });

        if (job) {
            return {
                queued: true,
                mode: 'queue',
                jobId: String(job.id)
            };
        }
    } catch (error) {
        logger.warn(`Failed to queue admin broadcast delivery ${String(broadcast?._id || '')}: ${error.message}`);
    }

    setImmediate(() => {
        deliverBroadcastNotificationsNow({
            targets: jobPayload.targets,
            voipTokens,
            pushPayload
        }).catch((error) => {
            logger.warn(`Async admin broadcast delivery failed for ${String(broadcast?._id || '')}: ${error.message}`);
        });
    });

    return {
        queued: false,
        mode: 'background'
    };
};

export const createBroadcastNotification = async ({ body = {}, adminId } = {}) => {
    const title = normalizeText(body?.title, 'title');
    const message = normalizeText(body?.message, 'message');
    const link = normalizeText(body?.link, 'link', false);
    const image = normalizeImageUrl(body?.image);
    const targetType = normalizeTargetType(body?.targetType);
    const voipTokens = normalizeVoipTokens(body?.voipToken || body?.voipTokens);
    const resolvedTargets = await resolveTargets({
        targetType,
        targetIds: body?.targetIds,
        targets: body?.targets
    });

    if (!resolvedTargets.length) {
        throw new ValidationError(`No recipients found for ${targetType.toLowerCase()} broadcast`);
    }

    const targetIds = resolvedTargets.map((target) => toObjectId(target.ownerId, 'targetId'));

    const broadcast = await BroadcastNotification.create({
        title,
        message,
        targetType,
        targetIds: targetType === 'CUSTOM' ? targetIds : [],
        targets: resolvedTargets.map((target) => ({
            ownerType: target.ownerType,
            ownerId: toObjectId(target.ownerId, 'ownerId'),
            label: target.label || '',
            subLabel: target.subLabel || ''
        })),
        link,
        createdBy: toObjectId(adminId, 'createdBy'),
        targetCount: resolvedTargets.length
    });

    await createInboxNotifications({
        notifications: resolvedTargets.map((target) =>
            buildNotificationPayload({
                title,
                message,
                link,
                image,
                broadcastId: broadcast._id,
                target
            })
        )
    });

    emitRealtimeNotifications(resolvedTargets, broadcast);

    const delivery = await enqueueBroadcastDelivery({
        broadcast,
        resolvedTargets,
        voipTokens,
        pushPayload: buildPushPayload({
            title,
            message,
            link,
            image,
            broadcastId: broadcast._id
        })
    });

    const pushReachable = await countPushReachable(resolvedTargets).catch(() => null);

    return {
        broadcast,
        targetPreview: resolvedTargets.slice(0, 10),
        delivery,
        recipientCount: resolvedTargets.length,
        pushReachable
    };
};

export const getBroadcastNotifications = async ({ page = 1, limit = 10 } = {}) => {
    const { skip, ...meta } = paginationMeta({ page, limit });

    const [items, total] = await Promise.all([
        BroadcastNotification.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(meta.limit)
            .populate('createdBy', 'name email')
            .lean(),
        BroadcastNotification.countDocuments({})
    ]);

    return {
        items: items.map((item) => ({
            ...item,
            targetLabel:
                item.targetType === 'CUSTOM'
                    ? `${Number(item.targetCount || item.targets?.length || 0)} selected recipients`
                    : OWNER_LABEL_MAP[item.targetType] || item.targetType
        })),
        pagination: {
            page: meta.page,
            limit: meta.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / meta.limit))
        }
    };
};

export const deleteBroadcastNotification = async (broadcastId) => {
    const normalizedId = toObjectId(broadcastId, 'broadcastId');
    const broadcast = await BroadcastNotification.findByIdAndDelete(normalizedId).lean();

    if (!broadcast) {
        throw new NotFoundError('Broadcast notification not found');
    }

    const result = await FoodNotification.deleteMany({ broadcastId: normalizedId });

    return {
        broadcast,
        deletedInboxCount: Number(result?.deletedCount || 0)
    };
};

const RECIPIENT_SEARCH_FIELDS = {
    USER: ['name', 'phone', 'email'],
    RESTAURANT: ['restaurantName', 'ownerName', 'ownerPhone', 'ownerEmail'],
    DELIVERY_PARTNER: ['name', 'phone', 'email']
};

/** Search users / restaurants / delivery partners by name, phone or email for a targeted send. */
export const searchBroadcastRecipients = async ({ ownerType, q = '', limit = 30 } = {}) => {
    const type = String(ownerType || '').trim().toUpperCase();
    const config = modelConfigMap[type];
    if (!config) throw new ValidationError('ownerType must be USER, RESTAURANT or DELIVERY_PARTNER');

    const term = String(q || '').trim().slice(0, 60);
    const filter = { ...config.query };
    if (term) {
        const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = RECIPIENT_SEARCH_FIELDS[type].map((field) => ({ [field]: rx }));
    }

    const rows = await config.model.find(filter)
        .select(`${config.select} fcmTokens fcmTokenMobile`)
        .sort({ createdAt: -1 })
        .limit(Math.max(1, Math.min(100, Number(limit) || 30)))
        .lean();

    return rows.map((row) => ({
        ownerType: type,
        ownerId: String(row._id),
        ...config.buildLabel(row),
        hasPush: (Array.isArray(row.fcmTokens) && row.fcmTokens.length > 0)
            || (Array.isArray(row.fcmTokenMobile) && row.fcmTokenMobile.length > 0)
    }));
};
