import { FoodHeroBanner } from '../models/heroBanner.model.js';
import { uploadBannerImage } from '../../../../services/upload.service.js';

export const listHeroBanners = async (bannerType) => {
    const query = {};
    if (bannerType && ['app', 'web'].includes(bannerType)) {
        query.bannerType = bannerType;
    }
    return FoodHeroBanner.find(query)
        .populate('linkedRestaurantIds')
        .sort({ sortOrder: 1, createdAt: 1 })
        .lean()
        .then(banners => banners.map(b => ({
            ...b,
            bannerType: b.bannerType || 'app',
            linkedRestaurants: b.linkedRestaurantIds
        })));
};

export const createHeroBannersFromFiles = async (files, meta = {}) => {
    if (!files || !files.length) {
        return [];
    }

    const results = [];

    for (const file of files) {
        try {
            const imageUrl = await uploadBannerImage(file.buffer);

            const banner = await FoodHeroBanner.create({
                imageUrl: imageUrl,
                publicId: null,
                title: meta.title,
                ctaText: meta.ctaText,
                ctaLink: meta.ctaLink,
                bannerType: meta.bannerType || 'app',
                linkedRestaurantIds: meta.linkedRestaurantIds || [],
                sortOrder: meta.sortOrder ?? 0,
                isActive: true
            });

            results.push({ success: true, banner: banner.toObject() });
        } catch (error) {
            results.push({ success: false, error: error.message });
        }
    }

    return results;
};

export const deleteHeroBanner = async (id) => {
    const doc = await FoodHeroBanner.findById(id);
    if (!doc) {
        return { deleted: false };
    }

    if (doc.publicId) {
        // legacy
    }

    await doc.deleteOne();
    return { deleted: true };
};

export const updateHeroBannerOrder = async (id, sortOrder) => {
    const updated = await FoodHeroBanner.findByIdAndUpdate(
        id,
        { sortOrder },
        { new: true }
    ).lean();
    return updated;
};

export const toggleHeroBannerStatus = async (id, isActive) => {
    const updated = await FoodHeroBanner.findByIdAndUpdate(
        id,
        { isActive },
        { new: true }
    ).lean();
    return updated;
};

export const linkRestaurantsToBanner = async (id, restaurantIds) => {
    const updated = await FoodHeroBanner.findByIdAndUpdate(
        id,
        { linkedRestaurantIds: restaurantIds },
        { new: true }
    ).populate('linkedRestaurantIds').lean();
    
    if (updated) {
        updated.linkedRestaurants = updated.linkedRestaurantIds;
    }
    return updated;
};

export const updateHeroBannerType = async (id, bannerType) => {
    const updated = await FoodHeroBanner.findByIdAndUpdate(
        id,
        { bannerType },
        { new: true }
    ).populate('linkedRestaurantIds').lean();

    if (updated) {
        updated.linkedRestaurants = updated.linkedRestaurantIds;
    }
    return updated;
};


