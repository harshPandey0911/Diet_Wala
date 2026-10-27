import { FoodExploreIcon } from '../models/exploreIcon.model.js';
import { uploadGenericImage } from '../../../../services/upload.service.js';

/**
 * List all explore icons (admin). Sorted by sortOrder.
 */
export const listExploreIcons = async () => {
    return FoodExploreIcon.find()
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();
};

/**
 * Get next sortOrder for new item.
 */
const getNextSortOrder = async () => {
    const last = await FoodExploreIcon.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    return (last?.sortOrder ?? -1) + 1;
};

/**
 * Upload buffer to Cloudinary and return { secure_url, public_id }.
 */


/**
 * Create one explore icon from uploaded file + label + link.
 * @param {{ buffer: Buffer }} file - multer file (req.file)
 * @param {{ label: string, link?: string }} meta
 */
export const createExploreIcon = async (file, meta) => {
    let secure_url = '';
    if (file?.buffer) {
        secure_url = await uploadGenericImage(file.buffer, 'explore-icons');
    } else if (meta?.iconUrl) {
        secure_url = String(meta.iconUrl).trim();
    } else {
        throw new Error('Image file or URL is required');
    }
    const label = (meta?.label || '').trim();
    if (!label) {
        throw new Error('Label is required');
    }

    const sortOrder = await getNextSortOrder();

    const doc = await FoodExploreIcon.create({
        label,
        iconUrl: secure_url,
        publicId: null,
        linkType: 'custom',
        targetPath: (meta?.link || '').trim() || undefined,
        sortOrder,
        isActive: true
    });

    return doc.toObject();
};

/**
 * Update explore icon: optional new image, optional label/link.
 * @param {string} id
 * @param {{ file?: { buffer: Buffer }, label?: string, link?: string }} payload
 */
export const updateExploreIcon = async (id, payload) => {
    const doc = await FoodExploreIcon.findById(id);
    if (!doc) {
        return null;
    }

    const updates = {};

    if (payload?.file?.buffer) {
        try {
            const secure_url = await uploadGenericImage(payload.file.buffer, 'explore-icons');
            updates.iconUrl = secure_url;
            updates.publicId = null;
        } catch (e) {
            throw new Error('Image upload failed');
        }
    } else if (payload?.iconUrl) {
        updates.iconUrl = String(payload.iconUrl).trim();
        updates.publicId = null;
    }

    if (payload?.label !== undefined) {
        updates.label = String(payload.label).trim();
    }
    if (payload?.link !== undefined) {
        updates.targetPath = String(payload.link).trim() || undefined;
    }

    if (Object.keys(updates).length === 0) {
        return doc.toObject();
    }

    const updated = await FoodExploreIcon.findByIdAndUpdate(id, updates, { new: true }).lean();
    return updated;
};

/**
 * Delete explore icon and Cloudinary asset.
 */
export const deleteExploreIcon = async (id) => {
    const doc = await FoodExploreIcon.findById(id);
    if (!doc) {
        return { deleted: false };
    }
    if (doc.publicId) {
        // legacy
    }
    await doc.deleteOne();
    return { deleted: true };
};

/**
 * Toggle isActive. Returns updated doc or null.
 */
export const toggleExploreIconStatus = async (id) => {
    const doc = await FoodExploreIcon.findById(id);
    if (!doc) return null;
    const isActive = !doc.isActive;
    const updated = await FoodExploreIcon.findByIdAndUpdate(id, { isActive }, { new: true }).lean();
    return updated;
};

/**
 * Update sortOrder. Body uses "order" for frontend compatibility.
 */
export const updateExploreIconOrder = async (id, order) => {
    const num = Number(order);
    if (Number.isNaN(num)) return null;
    const updated = await FoodExploreIcon.findByIdAndUpdate(id, { sortOrder: num }, { new: true }).lean();
    return updated;
};
