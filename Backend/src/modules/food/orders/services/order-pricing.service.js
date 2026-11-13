import mongoose from 'mongoose';
import { FoodOrder } from '../models/order.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { FoodBusinessSettings } from '../../admin/models/businessSettings.model.js';
import { assertAppOpenForZone } from '../../admin/services/appAvailability.service.js';
import { FoodOffer } from '../../admin/models/offer.model.js';
import { FoodOfferUsage } from '../../admin/models/offerUsage.model.js';
import { FoodZone } from '../../admin/models/zone.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { deliveryDistanceKm } from './order.helpers.js';
import { computePointsRedemption } from '../../loyalty/services/loyalty.service.js';
import { assertDeliveryLocationServiceable } from './delivery-location.service.js';

function isOfferEndDateValid(endDate, now = new Date()) {
  if (!endDate) return true;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return false;
  end.setUTCHours(23, 59, 59, 999);
  return now.getTime() <= end.getTime();
}

export async function calculateOrderPricing(userId, dto) {
  const restaurant = await FoodRestaurant.findById(dto.restaurantId)
    .select("status location itemDiscounts zoneId")
    .lean();
  if (!restaurant) throw new ValidationError("Restaurant not found");

  // App ON/OFF: platform-wide switch/hours and the restaurant zone's own switch/hours.
  await assertAppOpenForZone(restaurant.zoneId);

  if (restaurant.status !== "approved")
    throw new ValidationError("Restaurant not available");

  const feeSettings = await FoodFeeSettings.findOne({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();

  if (!feeSettings) {
    throw new ValidationError("Fee settings are not configured by admin.");
  }

  const items = Array.isArray(dto.items) ? dto.items : [];
  let itemDiscountTotal = 0;
  let subtotal = 0;
  let eligibleSubtotalForCoupon = 0;

  items.forEach((it) => {
    // it.price is already the customer-facing price: the menu APIs apply the admin's food
    // markup once when listing items, so it must not be applied again here.
    let price = Number(it.price) || 0;
    const qty = Number(it.quantity) || 1;

    // Item prices sent by the cart are already discounted. Keep the original price only
    // to report the savings in the bill; do not subtract this discount a second time.
    const originalPrice = Number(it.originalPrice);
    if (Number.isFinite(originalPrice) && originalPrice > price) {
      itemDiscountTotal += (originalPrice - price) * qty;
    }

    subtotal += price * qty;
    eligibleSubtotalForCoupon += price * qty;
  });
  subtotal = Math.round(subtotal);
  eligibleSubtotalForCoupon = Math.round(eligibleSubtotalForCoupon);
  itemDiscountTotal = Math.round(itemDiscountTotal);

  const packagingFee = (feeSettings.packagingFee != null && Number.isFinite(Number(feeSettings.packagingFee))) ? Number(feeSettings.packagingFee) : 0;

  const platformFee = (feeSettings.platformFee != null && Number.isFinite(Number(feeSettings.platformFee))) ? Number(feeSettings.platformFee) : 0;

  const freeUpTo = Number(feeSettings.freeDeliveryUpTo || 0);
  // Same distance as order placement uses for the rider's earning (see deliveryDistanceKm).
  const distanceKm = deliveryDistanceKm(
    restaurant?.location?.coordinates,
    dto?.deliveryAddress?.location?.coordinates,
  );
  let deliveryFee = 0;
  let deliveryFeeBreakdown = null;
  await assertDeliveryLocationServiceable({
    restaurantZoneId: restaurant.zoneId,
    deliveryCoordinates: dto?.deliveryAddress?.location?.coordinates,
    distanceKm,
  });

  if (
    Number.isFinite(freeUpTo) &&
    freeUpTo > 0 &&
    subtotal >= freeUpTo
  ) {
    deliveryFee = 0;
  } else {
    const ranges = Array.isArray(feeSettings.deliveryFeeRanges)
      ? [...feeSettings.deliveryFeeRanges]
      : [];
    if (ranges.length > 0) {
      const validRanges = ranges
        .map((r) => ({ min: Number(r?.min), max: Number(r?.max), fee: Number(r?.fee) }))
        .filter((r) => Number.isFinite(r.min) && Number.isFinite(r.max) && Number.isFinite(r.fee))
        .sort((a, b) => a.min - b.min);
      let matched = null;

      if (Number.isFinite(distanceKm) && validRanges.length > 0) {
        // Use the highest slab that has started at this distance. That covers a normal
        // in-range hit, a distance past the last slab, and a distance that falls in a gap
        // between two slabs (e.g. 3.5 km with "0-3" and "4-6" -> the 0-3 fee).
        // A distance before the first slab starts (e.g. 0.5 km when the first slab is
        // "1-3 km") gets the first slab's fee. Previously both of these fell back to the
        // LAST (most expensive) slab, so a 500 m order could be charged the top fee.
        let picked = null;
        for (const r of validRanges) {
          if (distanceKm >= r.min) picked = r;
        }
        if (!picked) picked = validRanges[0];

        matched = picked.fee;
        deliveryFeeBreakdown = {
          source: "distance",
          distanceKm,
          minKm: picked.min,
          maxKm: picked.max,
          fee: picked.fee,
        };
      }

      deliveryFee = Number.isFinite(matched)
        ? matched
        : (feeSettings.deliveryFee != null ? Number(feeSettings.deliveryFee) : NaN);
    } else {
      deliveryFee = feeSettings.deliveryFee != null ? Number(feeSettings.deliveryFee) : NaN;
    }
    
    if (!Number.isFinite(deliveryFee)) {
      throw new ValidationError("Base delivery fee is not configured by admin.");
    }
  }

  const gstRate = feeSettings.gstRate != null ? Number(feeSettings.gstRate) : 0;
  const gstOnDeliveryFee = feeSettings.gstOnDeliveryFee != null ? Number(feeSettings.gstOnDeliveryFee) : 0;
  const gstOnPlatformFee = feeSettings.gstOnPlatformFee != null ? Number(feeSettings.gstOnPlatformFee) : 0;
  const gstOnPackagingFee = feeSettings.gstOnPackagingFee != null ? Number(feeSettings.gstOnPackagingFee) : 0;

  const itemTax = (Number.isFinite(gstRate) && gstRate > 0) ? (subtotal * (gstRate / 100)) : 0;
  const deliveryTax = (Number.isFinite(gstOnDeliveryFee) && gstOnDeliveryFee > 0) ? (deliveryFee * (gstOnDeliveryFee / 100)) : 0;
  const platformTax = (Number.isFinite(gstOnPlatformFee) && gstOnPlatformFee > 0) ? (platformFee * (gstOnPlatformFee / 100)) : 0;
  const packagingTax = (Number.isFinite(gstOnPackagingFee) && gstOnPackagingFee > 0) ? (packagingFee * (gstOnPackagingFee / 100)) : 0;

  const tax = Math.round(itemTax + deliveryTax + platformTax + packagingTax);

  let discount = 0;
  let appliedCoupon = null;
  let couponError = null;
  const codeRaw = dto.couponCode
    ? String(dto.couponCode).trim().toUpperCase()
    : "";

  if (codeRaw) {
    const now = new Date();
    let offer = await FoodOffer.findOne({ couponCode: codeRaw }).lean();

    if (!offer) {
      const { default: Promocode } = await import('../../../../models/Promocode.js');
      const promo = await Promocode.findOne({ code: codeRaw, restaurantId: dto.restaurantId }).lean();
      if (promo) {
        offer = {
          _id: promo._id,
          status: promo.isActive ? "active" : "inactive",
          startDate: promo.startDate,
          endDate: promo.expiryDate,
          restaurantScope: "selected",
          restaurantId: promo.restaurantId,
          minOrderValue: promo.minOrderAmount || 0,
          usageLimit: promo.usageLimit || 0,
          usedCount: promo.usageCount || 0,
          discountType: promo.discountType === 'PERCENTAGE' ? 'percentage' : 'flat',
          discountValue: promo.discountValue,
          maxDiscount: promo.maxDiscountAmount || 0,
          perUserLimit: 0,
          customerScope: "all"
        };
      }
    }

    if (offer) {
      const statusOk = offer.status === "active";
      const startOk = !offer.startDate || now >= new Date(offer.startDate);
      const endOk = isOfferEndDateValid(offer.endDate, now);
      const scopeOk =
        offer.restaurantScope !== "selected" ||
        String(offer.restaurantId || "") === String(dto.restaurantId || "");
      const minOk = subtotal >= (Number(offer.minOrderValue) || 0);
      let usageOk = true;
      if (
        Number(offer.usageLimit) > 0 &&
        Number(offer.usedCount || 0) >= Number(offer.usageLimit)
      ) {
        usageOk = false;
      }

      // Coupon made for one particular user only.
      const userOk =
        offer.customerScope !== "specific" ||
        (Boolean(userId) && String(offer.userId || "") === String(userId));

      // Category coupon: discount applies only to items of that category.
      let couponBaseSubtotal = eligibleSubtotalForCoupon;
      let categoryMatched = true;
      if (offer.categoryId) {
        const itemIds = items
          .map((it) => String(it.itemId || ""))
          .filter((id) => mongoose.Types.ObjectId.isValid(id));
        const foods = itemIds.length
          ? await FoodItem.find({ _id: { $in: itemIds } }).select("categoryId").lean()
          : [];
        const inCategory = new Set(
          foods
            .filter((f) => String(f.categoryId || "") === String(offer.categoryId))
            .map((f) => String(f._id)),
        );
        couponBaseSubtotal = Math.round(
          items.reduce(
            (sum, it) =>
              inCategory.has(String(it.itemId))
                ? sum + (Number(it.price) || 0) * (Number(it.quantity) || 1)
                : sum,
            0,
          ),
        );
        categoryMatched = couponBaseSubtotal > 0;
      }

      let perUserOk = true;
      if (userId && Number(offer.perUserLimit) > 0) {
        const usage = await FoodOfferUsage.findOne({
          offerId: offer._id,
          userId,
        }).lean();
        if (usage && Number(usage.count) >= Number(offer.perUserLimit)) {
          perUserOk = false;
        }
      }

      let firstOrderOk = true;
      if (userId && offer.customerScope === "first-time") {
        const c = await FoodOrder.countDocuments({
          userId: new mongoose.Types.ObjectId(userId),
        });
        firstOrderOk = c === 0;
      }
      if (userId && offer.isFirstOrderOnly === true) {
        const c2 = await FoodOrder.countDocuments({
          userId: new mongoose.Types.ObjectId(userId),
        });
        if (c2 > 0) firstOrderOk = false;
      }

      const allowed =
        statusOk &&
        startOk &&
        endOk &&
        scopeOk &&
        userOk &&
        categoryMatched &&
        minOk &&
        usageOk &&
        perUserOk &&
        firstOrderOk;

      if (allowed) {
        if (couponBaseSubtotal <= 0) {
          couponError = "This coupon is not applicable on discounted items. Please try other items.";
        } else {
          if (offer.discountType === "percentage") {
            const raw = couponBaseSubtotal * (Number(offer.discountValue) / 100);
            const capped = Number(offer.maxDiscount)
              ? Math.min(raw, Number(offer.maxDiscount))
              : raw;
            discount = Math.max(0, Math.min(couponBaseSubtotal, Math.floor(capped)));
          } else {
            discount = Math.max(
              0,
              Math.min(
                couponBaseSubtotal,
                Math.floor(Number(offer.discountValue) || 0),
              ),
            );
          }
          appliedCoupon = { code: codeRaw, discount };
        }
      } else {
        if (!userOk) {
          couponError = "This coupon is not valid for your account.";
        } else if (!categoryMatched) {
          couponError = `This coupon is valid only on ${offer.categoryName || "selected category"} items. Add an item from that category.`;
        } else if (!minOk) {
          couponError = `Minimum order value of ${offer.minOrderValue} required for this coupon.`;
        } else if (!statusOk) {
          couponError = "This coupon is not active.";
        } else if (!startOk) {
          couponError = "This coupon is not active yet.";
        } else if (!endOk) {
          couponError = "This coupon has expired.";
        } else if (!scopeOk) {
          couponError = "This coupon is not valid for this restaurant.";
        } else if (!usageOk) {
          couponError = "This coupon has reached its usage limit.";
        } else if (!perUserOk) {
          couponError = "You have already used this coupon the maximum number of times.";
        } else if (!firstOrderOk) {
          couponError = "This coupon is only for first-time customers.";
        } else {
          couponError = "Coupon not applicable.";
        }
      }
    } else {
      couponError = "Invalid or expired coupon code.";
    }
  }

  const couponDiscount = discount;
  const totalDiscount = couponDiscount;
  const totalBeforeDiscount = subtotal + deliveryFee + tax + platformFee + packagingFee;
  const totalBeforePoints = Math.max(0, totalBeforeDiscount - totalDiscount);

  // Loyalty points redemption is applied last, on top of the coupon discount.
  const pointsRedemption = await computePointsRedemption(userId, subtotal, dto.redeemPoints);
  const total = Math.max(0, totalBeforePoints - pointsRedemption.discountAmount);

  return {
    pricing: {
      // Marker so a deploy can be verified from the browser Network tab: the checkout subtotal is
      // the sum of cart prices as-is (the food markup is NOT applied again here).
      pricingVersion: 'checkout-no-markup-v2',
      subtotal,
      tax,
      taxBreakdown: {
        itemTax,
        deliveryTax,
        platformTax,
        packagingTax
      },
      packagingFee,
      deliveryFee,
      deliveryFeeBreakdown: deliveryFeeBreakdown || undefined,
      freeDeliveryUpTo: Number.isFinite(freeUpTo) ? freeUpTo : undefined,
      platformFee,
      discount: totalDiscount,
      itemDiscount: itemDiscountTotal > 0 ? itemDiscountTotal : undefined,
      couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
      pointsDiscount: pointsRedemption.discountAmount,
      total,
      currency: "INR",
      couponCode: appliedCoupon?.code || codeRaw || null,
      appliedCoupon,
      couponError,
    },
    loyalty: {
      pointsRedeemed: pointsRedemption.pointsToRedeem,
      pointsDiscount: pointsRedemption.discountAmount,
      pointsBalance: pointsRedemption.balance,
      maxRedeemablePoints: pointsRedemption.maxRedeemablePoints,
      ratePerPoint: pointsRedemption.ratePerPoint,
      note: pointsRedemption.reason,
    },
  };
}
