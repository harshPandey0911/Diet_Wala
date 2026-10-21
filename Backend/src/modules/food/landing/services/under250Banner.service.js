import { FoodUnder250Banner } from '../models/under250Banner.model.js';
import { uploadBannerImage } from '../../../../services/upload.service.js';

export const listUnder250Banners = async () => {
    return FoodUnder250Banner.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
};

export const createUnder250BannersFromFiles = async (files, meta = {}) => {
    if (!files || !files.length) {
        return [];
    }

    const results = [];

    for (const file of files) {
        try {
            const imageUrl = await uploadBannerImage(file.buffer);

            const banner = await FoodUnder250Banner.create({
                imageUrl: imageUrl,
                publicId: null,
                title: meta.title,
                ctaText: meta.ctaText,
                ctaLink: meta.ctaLink,
                zoneId: meta.zoneId,
                bannerType: ['app', 'web', 'all'].includes(meta.bannerType) ? meta.bannerType : 'app',
                sortOrder: meta.sortOrder ?? 0,
                isActive: true,
            });

            results.push({ success: true, banner: banner.toObject() });
        } catch (error) {
            results.push({ success: false, error: error.message });
        }
    }

    return results;
};

export const deleteUnder250Banner = async (id) => {
    const doc = await FoodUnder250Banner.findById(id);
    if (!doc) {
        return { deleted: false };
    }

    if (doc.publicId) {
        // legacy
    }

    await doc.deleteOne();
    return { deleted: true };
};

export const updateUnder250BannerOrder = async (id, sortOrder) => {
    const updated = await FoodUnder250Banner.findByIdAndUpdate(
        id,
        { sortOrder },
        { new: true }
    ).lean();
    return updated;
};

export const toggleUnder250BannerStatus = async (id, isActive) => {
    const updated = await FoodUnder250Banner.findByIdAndUpdate(
        id,
        { isActive },
        { new: true }
    ).lean();
    return updated;
};

