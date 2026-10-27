import crypto from "crypto";
import bcrypt from "bcryptjs";
import ms from "ms";
import { FoodUser } from "../users/user.model.js";
import { FoodAdmin } from "../admin/admin.model.js";
import { AdminResetOtp } from "../admin/adminResetOtp.model.js";
import { FoodRestaurant } from "../../modules/food/restaurant/models/restaurant.model.js";
import { FoodDeliveryPartner } from "../../modules/food/delivery/models/deliveryPartner.model.js";
import { FoodReferralSettings } from "../../modules/food/admin/models/referralSettings.model.js";
import { FoodReferralLog } from "../../modules/food/admin/models/referralLog.model.js";
import { createOrUpdateOtp, verifyOtp } from "../otp/otp.service.js";
import { signAccessToken, signRefreshToken } from "./token.util.js";
import { FoodRefreshToken } from "../refreshTokens/refreshToken.model.js";
import { ValidationError, AuthError } from "./errors.js";
import { config } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { sendAdminResetOtpEmail } from "../../utils/email.js";
import mongoose from "mongoose";
import { creditReferralReward } from "../../modules/food/user/services/userWallet.service.js";

const ROLES = {
  USER: "USER",
  RESTAURANT: "RESTAURANT",
  DELIVERY_PARTNER: "DELIVERY_PARTNER",
  ADMIN: "ADMIN",
};

const toSafeImageUrl = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.url || value.secure_url || "";
  return "";
};

const sanitizeUserForAuthResponse = (userDoc = {}) => {
  const id = userDoc?._id?.toString?.() || userDoc?.id?.toString?.() || userDoc?._id || userDoc?.id || null;
  return {
    id,
    _id: id,
    name: userDoc?.name || "",
    phone: userDoc?.phone || "",
    email: userDoc?.email || "",
    role: userDoc?.role || ROLES.USER,
    isVerified: Boolean(userDoc?.isVerified),
    isActive: userDoc?.isActive !== false,
    profileImage: toSafeImageUrl(userDoc?.profileImage),
    gender: userDoc?.gender || null,
    referralCode: userDoc?.referralCode || "",
    refCode: userDoc?.referralCode || "",
    referralCount: Number(userDoc?.referralCount || 0),
    walletAmount: Number(userDoc?.walletAmount || 0),
    hasPasscode: Boolean(userDoc?.hasPasscode),
  };
};

const sanitizeRestaurantForAuthResponse = (restaurantDoc = {}) => {
  const id =
    restaurantDoc?._id?.toString?.() ||
    restaurantDoc?.id?.toString?.() ||
    restaurantDoc?._id ||
    restaurantDoc?.id ||
    null;

  return {
    id,
    _id: id,
    name: restaurantDoc?.restaurantName || restaurantDoc?.name || "",
    restaurantName: restaurantDoc?.restaurantName || "",
    phone: restaurantDoc?.ownerPhone || restaurantDoc?.primaryContactNumber || "",
    email: restaurantDoc?.ownerEmail || "",
    status: restaurantDoc?.status || "",
    profileImage: toSafeImageUrl(restaurantDoc?.profileImage),
    createdAt: restaurantDoc?.createdAt,
    hasPasscode: Boolean(restaurantDoc?.hasPasscode),
  };
};

const sanitizeDeliveryForAuthResponse = (deliveryDoc = {}) => {
  const id =
    deliveryDoc?._id?.toString?.() ||
    deliveryDoc?.id?.toString?.() ||
    deliveryDoc?._id ||
    deliveryDoc?.id ||
    null;

  return {
    id,
    _id: id,
    name: deliveryDoc?.name || "",
    phone: deliveryDoc?.phone || "",
    email: deliveryDoc?.email || "",
    status: deliveryDoc?.status || "",
    profileImage: toSafeImageUrl(deliveryDoc?.profilePhoto),
    walletAmount: Number(deliveryDoc?.walletAmount || 0),
    refCode: deliveryDoc?.referralCode || "",
    createdAt: deliveryDoc?.createdAt,
    hasPasscode: Boolean(deliveryDoc?.hasPasscode),
  };
};

export const requestUserOtp = async (phone, purpose = "login") => {
  if (!phone) {
    throw new ValidationError("Phone is required");
  }

  const otp = await createOrUpdateOtp(phone, purpose);
  const shouldExposeOtp = config.nodeEnv !== "production" && config.useDefaultOtp;
  return shouldExposeOtp ? { otp } : {};
};

export const verifyUserOtpAndLogin = async (
  phone,
  otp,
  ref,
  fcmToken,
  platform,
  name,
  purpose = "login",
) => {
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const existingUser = await FoodUser.findOne({ phone });
  const needsNamePrompt = !existingUser && !trimmedName;

  const result = await verifyOtp(phone, otp, { consume: !needsNamePrompt, purpose });

  if (!result.valid) {
    throw new AuthError(result.reason || "OTP verification failed");
  }

  // For first-time signup, require name before completing registration.
  // We return a special flag without consuming the OTP so the frontend can prompt the user.
  if (needsNamePrompt) {
    return {
      isNewUser: true,
      needsName: true
    };
  }

  let userDoc = existingUser;
  
  // Ensure user exists and mark as verified on successful OTP.
  const isNewUser = !existingUser;

  if (!userDoc) {
    userDoc = await FoodUser.create({
      phone,
      isVerified: true,
      name: trimmedName,
    });
  } else {
    let needsSave = false;
    if (!userDoc.isVerified) {
      userDoc.isVerified = true;
      needsSave = true;
    }
    if (trimmedName && !userDoc.name) {
      userDoc.name = trimmedName;
      needsSave = true;
    }
    if (needsSave) await userDoc.save();
  }

  // Block login for deactivated users
  if (userDoc.isActive === false) {
    throw new AuthError(
      "Your account has been deactivated. Please contact support.",
    );
  }

  // Update FCM token if provided
  if (fcmToken) {
    let isModified = false;
    if (platform === "mobile") {
      if (!userDoc.fcmTokenMobile) userDoc.fcmTokenMobile = [];
      if (!userDoc.fcmTokenMobile.includes(fcmToken)) {
        userDoc.fcmTokenMobile.push(fcmToken);
        isModified = true;
      }
    } else {
      // Default to web if not explicitly mobile
      if (!userDoc.fcmTokens) userDoc.fcmTokens = [];
      if (!userDoc.fcmTokens.includes(fcmToken)) {
        userDoc.fcmTokens.push(fcmToken);
        isModified = true;
      }
    }
    if (isModified) {
      await userDoc.save();
    }
  }

  // Ensure referralCode exists (used for share links on older accounts).
  if (!userDoc.referralCode) {
    userDoc.referralCode = String(userDoc._id);
    await userDoc.save();
  }

  // Referral crediting: only for brand new accounts.
  const refRaw = typeof ref === "string" ? String(ref).trim() : "";
  if (isNewUser && refRaw) {
    try {
      if (mongoose.Types.ObjectId.isValid(refRaw)) {
        const referrerId = new mongoose.Types.ObjectId(refRaw);
        if (String(referrerId) !== String(userDoc._id)) {
          const [referrer, settingsDoc] = await Promise.all([
            FoodUser.findById(referrerId).select("_id referralCount").lean(),
            FoodReferralSettings.findOne({ isActive: true })
              .sort({ createdAt: -1 })
              .lean(),
          ]);

          if (referrer && settingsDoc) {
            const reward = Math.max(
              0,
              Number(settingsDoc.referralRewardUser) || 0,
            );
            const limit = Math.max(
              0,
              Number(settingsDoc.referralLimitUser) || 0,
            );

            if (
              reward > 0 &&
              limit > 0 &&
              Number(referrer.referralCount || 0) < limit
            ) {
              userDoc.referredBy = referrerId;
              await userDoc.save();

              const log = await FoodReferralLog.create({
                referrerId,
                refereeId: userDoc._id,
                role: "USER",
                rewardAmount: reward,
                status: "credited",
              });

              await Promise.all([
                FoodUser.updateOne(
                  { _id: referrerId },
                  { $inc: { referralCount: 1 } },
                ),
                creditReferralReward(referrerId, reward, {
                  role: "USER",
                  refereeId: String(userDoc._id),
                  referralLogId: String(log._id),
                }),
                creditReferralReward(userDoc._id, reward, {
                  role: "USER",
                  referrerId: String(referrerId),
                  referralLogId: String(log._id),
                  note: "Signup via referral bonus",
                }),
              ]);
            } else {
              await FoodReferralLog.create({
                referrerId,
                refereeId: userDoc._id,
                role: "USER",
                rewardAmount: reward,
                status: "rejected",
                reason:
                  reward <= 0
                    ? "reward_disabled"
                    : limit <= 0
                      ? "limit_disabled"
                      : "limit_reached",
              });
            }
          }
        }
      }
    } catch (e) {
      // Never fail login due to referral errors.
      logger?.warn?.({ err: e }, "Referral crediting failed (user)");
    }
  }

  const user = userDoc.toObject();
  const payload = {
    userId: user._id.toString(),
    role: user.role || "USER",
    ...(purpose === "passcode_reset" ? { passcodeResetVerified: true } : {}),
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const ttlMs = ms(config.jwtRefreshExpiresIn || "7d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt,
  });

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: sanitizeUserForAuthResponse(user),
    isNewUser,
    requiresPasscodeSetup: purpose === "passcode_reset" || !userDoc.hasPasscode,
  };
};

export const adminLogin = async (email, password) => {
  if (!email || !password) {
    throw new ValidationError("Email and password are required");
  }

  const admin = await FoodAdmin.findOne({ email });
  if (!admin) {
    throw new AuthError("Invalid credentials");
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    throw new AuthError("Invalid credentials");
  }

  const payload = { userId: admin._id.toString(), role: admin.role };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const ttlMs = ms(config.jwtRefreshExpiresIn || "7d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.create({
    userId: admin._id,
    token: refreshToken,
    expiresAt,
  });

  const userObj = admin.toObject();
  delete userObj.password;
  return { accessToken, refreshToken, user: userObj };
};

export const requestRestaurantOtp = async (phone, purpose = "login") => {
  if (!phone) {
    throw new ValidationError("Phone is required");
  }
  const otp = await createOrUpdateOtp(phone, purpose);
  // Only expose OTP in response when in default/dev mode — never in production with real SMS
  const shouldExposeOtp = config.nodeEnv !== "production" && config.useDefaultOtp;
  return shouldExposeOtp ? { otp } : {};
};

export const verifyRestaurantOtpAndLogin = async (phone, otp, fcmToken, platform, purpose = "login") => {
  const result = await verifyOtp(phone, otp, { consume: true, purpose });
  if (!result.valid) {
    throw new AuthError(result.reason || "OTP verification failed");
  }

  // Restaurants may store ownerPhone with country code or formatting, or normalized fields.
  // Match by exact phone, last-10 digits, suffix match, or normalized fields to avoid false "needsRegistration".
  const digits = String(phone || "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  const phoneCandidates = [phone, digits, last10].filter(Boolean);
  const phoneOrFields = (field) => [
    { [field]: { $in: phoneCandidates } },
    ...(last10 ? [{ [field]: { $regex: new RegExp(last10 + "$") } }] : []),
  ];

  const restaurant = await FoodRestaurant.findOne({
    $or: [
      ...phoneOrFields("ownerPhone"),
      ...phoneOrFields("primaryContactNumber"),
      ...phoneOrFields("ownerPhoneDigits"),
      ...phoneOrFields("ownerPhoneLast10"),
    ],
  });
    const restaurantDoc = restaurant;
    if (!restaurantDoc) {
      return {
        needsRegistration: true,
        phone,
      };
    }

  // Update FCM token if provided
  if (fcmToken) {
    let isModified = false;
    if (platform === "mobile") {
      if (!restaurantDoc.fcmTokenMobile) restaurantDoc.fcmTokenMobile = [];
      if (!restaurantDoc.fcmTokenMobile.includes(fcmToken)) {
        restaurantDoc.fcmTokenMobile.push(fcmToken);
        isModified = true;
      }
    } else {
      if (!restaurantDoc.fcmTokens) restaurantDoc.fcmTokens = [];
      if (!restaurantDoc.fcmTokens.includes(fcmToken)) {
        restaurantDoc.fcmTokens.push(fcmToken);
        isModified = true;
      }
    }
    if (isModified) {
      await restaurantDoc.save();
    }
  }

  // If restaurant approval status is used, handle pending/rejected states by returning info instead of throwing errors.
  // Legacy restaurants created before this feature was rolled out (May 26, 2026) bypass this block.
  const isLegacyRestaurant = restaurantDoc.createdAt && new Date(restaurantDoc.createdAt) < new Date("2026-05-26T00:00:00Z");
  if (restaurantDoc.status && restaurantDoc.status !== "approved" && !isLegacyRestaurant) {
    return {
      pendingApproval: true,
      status: restaurantDoc.status,
      isRejected: restaurantDoc.status === "rejected",
      rejectionReason: restaurantDoc.rejectionReason || null,
      phone,
    };
  }

  const payload = { userId: restaurantDoc._id.toString(), role: ROLES.RESTAURANT };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const ttlMs = ms(config.jwtRefreshExpiresIn || "7d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.create({
    userId: restaurantDoc._id,
    token: refreshToken,
    expiresAt,
  });

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: sanitizeRestaurantForAuthResponse(restaurantDoc?.toObject?.() || restaurantDoc),
    needsRegistration: false,
    requiresPasscodeSetup: !restaurantDoc.hasPasscode,
  };
};

export const requestDeliveryOtp = async (phone, purpose = "login") => {
  if (!phone) {
    throw new ValidationError("Phone is required");
  }
  const otp = await createOrUpdateOtp(phone, purpose);
  // Only expose OTP in response when in default/dev mode — never in production with real SMS
  const shouldExposeOtp = config.nodeEnv !== "production" && config.useDefaultOtp;
  return shouldExposeOtp ? { otp } : {};
};

const normalizePhoneForDelivery = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.slice(-10) || null;
};

export const verifyDeliveryOtpAndLogin = async (phone, otp, fcmToken, platform, purpose = "login") => {
  const result = await verifyOtp(phone, otp, { consume: true, purpose });
  if (!result.valid) {
    throw new AuthError(result.reason || "OTP verification failed");
  }

  const normalized = normalizePhoneForDelivery(phone);
  if (!normalized) {
    return { needsRegistration: true, phone };
  }

  const deliveryPartner = await FoodDeliveryPartner.findOne({
    $or: [
      { phone: normalized },
      { phone: { $regex: new RegExp(normalized + "$") } },
    ],
  });

  if (!deliveryPartner) {
    return { needsRegistration: true, phone };
  }

  // Update FCM token if provided - CRITICAL: do this BEFORE returning pendingApproval
  // so we can notify them when approved.
  if (fcmToken) {
    let isModified = false;
    if (platform === "mobile") {
      if (!deliveryPartner.fcmTokenMobile) deliveryPartner.fcmTokenMobile = [];
      if (!deliveryPartner.fcmTokenMobile.includes(fcmToken)) {
        deliveryPartner.fcmTokenMobile.push(fcmToken);
        isModified = true;
      }
    } else {
      if (!deliveryPartner.fcmTokens) deliveryPartner.fcmTokens = [];
      if (!deliveryPartner.fcmTokens.includes(fcmToken)) {
        deliveryPartner.fcmTokens.push(fcmToken);
        isModified = true;
      }
    }
    if (isModified) {
      await deliveryPartner.save();
    }
  }

  // Bypass for legacy delivery partners created before this feature was rolled out.
  const isLegacyDelivery = deliveryPartner.createdAt && new Date(deliveryPartner.createdAt) < new Date("2026-05-26T00:00:00Z");
  if (deliveryPartner.status && deliveryPartner.status !== "approved" && !isLegacyDelivery) {
    const isRejected = deliveryPartner.status === "rejected";
    return {
      pendingApproval: true,
      isRejected,
      rejectionReason: isRejected ? deliveryPartner.rejectionReason : null,
      message:
        isRejected
          ? (deliveryPartner.rejectionReason 
              ? `Your account was rejected: ${deliveryPartner.rejectionReason}`
              : "Your delivery account was not approved. Please contact support.")
          : "Your account is pending admin verification. You will be notified once approved.",
    };
  }

  const payload = {
    userId: deliveryPartner._id.toString(),
    role: ROLES.DELIVERY_PARTNER,
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const ttlMs = ms(config.jwtRefreshExpiresIn || "7d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.create({
    userId: deliveryPartner._id,
    token: refreshToken,
    expiresAt,
  });

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: sanitizeDeliveryForAuthResponse(
      deliveryPartner?.toObject?.() || deliveryPartner,
    ),
    needsRegistration: false,
    requiresPasscodeSetup: !deliveryPartner.hasPasscode,
  };
};

export const logout = async (refreshToken, fcmToken, platform) => {
  const sanitizedFcmToken = fcmToken ? String(fcmToken).trim().replace(/^["']|["']$/g, '') : null;

  if (!refreshToken && !sanitizedFcmToken) {
    throw new ValidationError("Refresh token or FCM token is required");
  }

  // 1. Remove specific FCM token from ALL collections if provided
  if (sanitizedFcmToken) {
    console.log(`[FCM-Logout] Starting logout-driven token removal: platform=${platform}, tokenPreview=${sanitizedFcmToken?.slice(0, 10)}...`);
    
    // We try to remove the token from all 4 possible models regardless of the user ID, 
    // ensuring no stale connections are left across any role or app the user was logged into.
    const models = [FoodUser, FoodRestaurant, FoodDeliveryPartner, FoodAdmin];
    
    try {
      await Promise.all(
        models.map((model) =>
          model.updateMany(
            { $or: [{ fcmTokens: sanitizedFcmToken }, { fcmTokenMobile: sanitizedFcmToken }] },
            { $pull: { fcmTokens: sanitizedFcmToken, fcmTokenMobile: sanitizedFcmToken } },
          ),
        ),
      );
      console.log("[FCM-Logout] Token removed from all collections successfully");
    } catch (err) {
      logger.warn({ err }, "Failed to remove FCM token from all collections during logout");
    }
  }

  // 2. Invalidate the refresh token (standard logout procedure)
  let invalidated = false;
  if (refreshToken) {
    const deleted = await FoodRefreshToken.deleteOne({ token: refreshToken });
    invalidated = deleted.deletedCount > 0;
  }
  
  return { invalidated };
};

export const getProfile = async (userId, role) => {
  if (!userId || !role) {
    throw new AuthError("Invalid token payload");
  }
  let profile = null;
  const id = userId;

  switch (role) {
    case ROLES.USER:
      profile = await FoodUser.findById(id).lean();
      break;
    case ROLES.ADMIN:
    case 'SUPER_ADMIN':
    case 'SUB_ADMIN':
      profile = await FoodAdmin.findById(id).select("-password").lean();
      break;
    case ROLES.RESTAURANT:
      {
        const doc = await FoodRestaurant.findById(id).lean();
        if (!doc) break;

        const location =
          doc.addressLine1 ||
          doc.addressLine2 ||
          doc.area ||
          doc.city ||
          doc.state ||
          doc.pincode ||
          doc.landmark
            ? {
                addressLine1: doc.addressLine1 || "",
                addressLine2: doc.addressLine2 || "",
                area: doc.area || "",
                city: doc.city || "",
                state: doc.state || "",
                pincode: doc.pincode || "",
                landmark: doc.landmark || "",
              }
            : null;

        const menuImages = Array.isArray(doc.menuImages)
          ? doc.menuImages
              .map((m) => (m && (typeof m === "string" ? m : m.url)) || null)
              .filter(Boolean)
              .map((url) => ({ url, publicId: null }))
          : [];

        profile = {
          id: doc._id,
          _id: doc._id,
          // Frontend expects "name" and "location" for restaurant screens.
          name: doc.restaurantName || "",
          restaurantName: doc.restaurantName || "",
          cuisines: Array.isArray(doc.cuisines) ? doc.cuisines : [],
          location,
          ownerName: doc.ownerName || "",
          ownerEmail: doc.ownerEmail || "",
          ownerPhone: doc.ownerPhone || "",
          primaryContactNumber: doc.primaryContactNumber || "",
          profileImage: doc.profileImage ? { url: doc.profileImage } : null,
          menuImages,
          coverImages: [],
          openingTime: doc.openingTime || null,
          closingTime: doc.closingTime || null,
          openDays: Array.isArray(doc.openDays) ? doc.openDays : [],
          status: doc.status || null,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          // These fields may not exist yet in DB, keep stable defaults for UI.
          rating: typeof doc.rating === "number" ? doc.rating : 0,
          totalRatings:
            typeof doc.totalRatings === "number" ? doc.totalRatings : 0,
          hasPasscode: Boolean(doc.hasPasscode),
        };
      }
      break;
    case ROLES.DELIVERY_PARTNER: {
      const partner = await FoodDeliveryPartner.findById(id).lean();
      if (!partner) break;
      const deliveryId = partner._id
        ? `DP-${partner._id.toString().slice(-8).toUpperCase()}`
        : null;
      profile = {
        ...partner,
        email: partner.email || null,
        deliveryId,
        status: partner.status === "rejected" ? "blocked" : partner.status,
        profileImage: partner.profilePhoto
          ? { url: partner.profilePhoto }
          : null,
        documents: {
          aadhar:
            partner.aadharPhoto || partner.aadharNumber
              ? {
                  number: partner.aadharNumber || null,
                  document: partner.aadharPhoto || null,
                }
              : null,
          pan:
            partner.panPhoto || partner.panNumber
              ? {
                  number: partner.panNumber || null,
                  document: partner.panPhoto || null,
                }
              : null,
          drivingLicense: partner.drivingLicensePhoto || partner.drivingLicenseNumber
            ? {
                number: partner.drivingLicenseNumber || null,
                document: partner.drivingLicensePhoto || null,
              }
            : null,
          bankDetails:
            partner.bankAccountHolderName ||
            partner.bankAccountNumber ||
            partner.bankIfscCode ||
            partner.bankName ||
            partner.upiId ||
            partner.upiQrCode
              ? {
                  accountHolderName: partner.bankAccountHolderName || null,
                  accountNumber: partner.bankAccountNumber || null,
                  ifscCode: partner.bankIfscCode || null,
                  bankName: partner.bankName || null,
                  upiId: partner.upiId || null,
                  upiQrCode: partner.upiQrCode || null,
                }
              : null,
        },
        location:
          partner.address || partner.city || partner.state
            ? {
                addressLine1: partner.address,
                city: partner.city,
                state: partner.state,
              }
            : null,
        vehicle:
          partner.vehicleType || partner.vehicleName || partner.vehicleNumber
            ? {
                type: partner.vehicleType,
                brand: partner.vehicleName,
                model: partner.vehicleName,
                number: partner.vehicleNumber,
              }
            : null,
      };
      break;
    }
    default:
      throw new AuthError("Unknown role");
  }

  if (!profile) {
    throw new AuthError("Profile not found");
  }
  delete profile.passcodeHash;
  delete profile.passcodeFailedAttempts;
  delete profile.passcodeLockedUntil;
  profile.hasPasscode = Boolean(profile.hasPasscode);
  return { user: profile };
};

const PASSCODE_ROLES = {
  user: { role: ROLES.USER, model: FoodUser },
  restaurant: { role: ROLES.RESTAURANT, model: FoodRestaurant },
  delivery: { role: ROLES.DELIVERY_PARTNER, model: FoodDeliveryPartner },
};

const normalizeAuthPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

const findPasscodeAccount = async (moduleName, phone, includeSecrets = false) => {
  const entry = PASSCODE_ROLES[moduleName];
  if (!entry) throw new ValidationError("Unsupported account type");
  const normalized = normalizeAuthPhone(phone);
  if (!/^\d{10}$/.test(normalized)) throw new ValidationError("A valid 10-digit phone number is required");
  const suffix = new RegExp(`${normalized}$`);
  let query;
  if (moduleName === "restaurant") {
    query = entry.model.findOne({ $or: [
      { ownerPhoneLast10: normalized }, { ownerPhoneDigits: normalized },
      { ownerPhone: suffix }, { primaryContactNumber: suffix },
    ] });
  } else {
    query = entry.model.findOne({ phone: suffix });
  }
  if (includeSecrets) query = query.select("+passcodeHash +passcodeFailedAttempts +passcodeLockedUntil");
  return { account: await query, normalized, ...entry };
};

const ensureAccountCanLogin = (moduleName, account) => {
  if (moduleName === "user" && account.isActive === false) throw new AuthError("Account is not available");
  if (["restaurant", "delivery"].includes(moduleName) && account.status && account.status !== "approved") {
    const isLegacyAccount = account.createdAt && new Date(account.createdAt) < new Date("2026-05-26T00:00:00Z");
    if (!isLegacyAccount) throw new AuthError("Account is not available");
  }
};

const createPasscodeSession = async (moduleName, account, role) => {
  const payload = { userId: account._id.toString(), role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await FoodRefreshToken.create({
    userId: account._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + ms(config.jwtRefreshExpiresIn || "7d")),
  });
  const raw = account.toObject ? account.toObject() : account;
  const sanitizer = moduleName === "user"
    ? sanitizeUserForAuthResponse
    : moduleName === "restaurant" ? sanitizeRestaurantForAuthResponse : sanitizeDeliveryForAuthResponse;
  return { token: accessToken, accessToken, refreshToken, user: sanitizer(raw) };
};

export const checkPasscodeStatus = async (moduleName, phone) => {
  const { account } = await findPasscodeAccount(moduleName, phone);
  return { exists: Boolean(account), hasPasscode: Boolean(account?.hasPasscode) };
};

export const loginWithPasscode = async (moduleName, phone, passcode) => {
  if (!/^\d{4}$/.test(String(passcode || ""))) throw new AuthError("Invalid phone number or passcode");
  const { account, role } = await findPasscodeAccount(moduleName, phone, true);
  if (!account?.hasPasscode || !account.passcodeHash) throw new AuthError("Invalid phone number or passcode");
  ensureAccountCanLogin(moduleName, account);
  const now = new Date();
  if (account.passcodeLockedUntil && account.passcodeLockedUntil > now) {
    const error = new AuthError("Too many attempts. Please use OTP or try again later.");
    error.statusCode = 429;
    throw error;
  }
  const valid = await bcrypt.compare(String(passcode), account.passcodeHash);
  if (!valid) {
    const attempts = Number(account.passcodeFailedAttempts || 0) + 1;
    const update = attempts >= 5
      ? { passcodeFailedAttempts: 0, passcodeLockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
      : { passcodeFailedAttempts: attempts, passcodeLockedUntil: null };
    await account.constructor.updateOne({ _id: account._id }, { $set: update });
    throw new AuthError("Invalid phone number or passcode");
  }
  await account.constructor.updateOne({ _id: account._id }, { $set: { passcodeFailedAttempts: 0, passcodeLockedUntil: null } });
  account.hasPasscode = true;
  return createPasscodeSession(moduleName, account, role);
};

export const setOrUpdatePasscode = async (userId, role, newPasscode, confirmPasscode, currentPasscode, passcodeResetVerified = false) => {
  if (!/^\d{4}$/.test(String(newPasscode || ""))) throw new ValidationError("Passcode must be exactly 4 digits");
  if (newPasscode !== confirmPasscode) throw new ValidationError("Passcodes do not match");
  const moduleName = role === ROLES.USER ? "user" : role === ROLES.RESTAURANT ? "restaurant" : role === ROLES.DELIVERY_PARTNER ? "delivery" : null;
  if (!moduleName) throw new AuthError("Unsupported account type");
  const { model } = PASSCODE_ROLES[moduleName];
  const account = await model.findById(userId).select("+passcodeHash");
  if (!account) throw new AuthError("Account is not available");
  ensureAccountCanLogin(moduleName, account);
  if (account.hasPasscode && !passcodeResetVerified) {
    const currentValid = /^\d{4}$/.test(String(currentPasscode || "")) && await bcrypt.compare(String(currentPasscode), account.passcodeHash || "");
    if (!currentValid) throw new AuthError("Current passcode is incorrect");
  }
  account.passcodeHash = await bcrypt.hash(String(newPasscode), config.bcryptSaltRounds || 10);
  account.hasPasscode = true;
  account.passcodeFailedAttempts = 0;
  account.passcodeLockedUntil = null;
  await account.save();
  return { hasPasscode: true };
};

const ADMIN_SERVICES_ALLOWED = ["food", "quickCommerce", "taxi"];

/** Update admin profile (name, email, phone, profileImage). Only for ADMIN role. */
export const updateAdminProfile = async (userId, body) => {
  if (!userId) {
    throw new AuthError("Invalid token payload");
  }
  const admin = await FoodAdmin.findById(userId);
  if (!admin) {
    throw new AuthError("Profile not found");
  }
  if (body.name !== undefined) admin.name = String(body.name || "").trim();
  if (body.email !== undefined) {
    const normalizedEmail = String(body.email || "")
      .trim()
      .toLowerCase();
    if (!normalizedEmail) {
      throw new ValidationError("Email is required");
    }
    if (normalizedEmail !== admin.email) {
      const duplicateAdmin = await FoodAdmin.findOne({
        _id: { $ne: admin._id },
        email: normalizedEmail,
      })
        .select("_id")
        .lean();
      if (duplicateAdmin) {
        throw new ValidationError("Email is already in use");
      }
    }
    admin.email = normalizedEmail;
  }
  if (body.phone !== undefined) admin.phone = String(body.phone || "").trim();
  if (body.profileImage !== undefined)
    admin.profileImage = String(body.profileImage || "").trim();
  // Normalize servicesAccess so legacy values (e.g. 'zomato') don't fail schema validation on save
  if (Array.isArray(admin.servicesAccess)) {
    const valid = admin.servicesAccess.filter((s) =>
      ADMIN_SERVICES_ALLOWED.includes(s),
    );
    admin.servicesAccess = valid.length ? valid : ["food"];
  } else {
    admin.servicesAccess = ["food"];
  }
  await admin.save();
  const profile = admin.toObject();
  delete profile.password;
  return { user: profile };
};

/** Change admin password. Only for ADMIN role. */
export const changeAdminPassword = async (
  userId,
  currentPassword,
  newPassword,
) => {
  if (!userId) {
    throw new AuthError("Invalid token payload");
  }
  const admin = await FoodAdmin.findById(userId);
  if (!admin) {
    throw new AuthError("Profile not found");
  }
  const isMatch = await admin.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AuthError("Current password is incorrect");
  }
  if (!newPassword || String(newPassword).length < 6) {
    throw new ValidationError("New password must be at least 6 characters");
  }
  admin.password = newPassword;
  await admin.save();

  try {
    const { notifyAdminsSafely } = await import("../../core/notifications/firebase.service.js");
    void notifyAdminsSafely({
      title: "Security Alert: Password Changed 🔐",
      body: `The password for admin account ${admin.email} has been changed. If this was not you, please contact support immediately.`,
      data: {
        type: "security_alert",
        subType: "password_change",
        email: admin.email
      }
    });
  } catch (e) {
    console.error("Failed to notify admins of password change:", e);
  }

  return { success: true };
};

/** Admin forgot password: request OTP. Only accepts email that is registered as admin. */
export const requestAdminForgotPasswordOtp = async (email) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    throw new ValidationError("Email is required");
  }

  const admin = await FoodAdmin.findOne({ email: normalizedEmail });
  if (!admin) {
    throw new AuthError("This email is not registered as an admin account.");
  }

  const otp = config.useDefaultOtp
    ? "123456"
    : String(crypto.randomInt(100000, 999999));
  const ttlMs = (config.otpExpiryMinutes || 10) * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  await AdminResetOtp.findOneAndUpdate(
    { email: normalizedEmail },
    { otp, expiresAt, attempts: 0 },
    { upsert: true, new: true },
  );

  if (config.useDefaultOtp) {
    logger.info(`Admin reset OTP for ${normalizedEmail}: ${otp}`);
  }

  const sent = await sendAdminResetOtpEmail(normalizedEmail, otp);
  if (!sent && !config.useDefaultOtp) {
    logger.warn(
      `Admin OTP not sent by email to ${normalizedEmail}; check SMTP config.`,
    );
  }

  return {
    success: true,
    message: "If this email is registered, you will receive an OTP shortly.",
  };
};

/** Admin forgot password: verify OTP and set new password in one call. */
export const resetAdminPasswordWithOtp = async (email, otp, newPassword) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const otpStr = String(otp || "").replace(/\D/g, "");
  if (!normalizedEmail || !otpStr) {
    throw new ValidationError("Email and OTP are required");
  }
  if (!newPassword || String(newPassword).length < 6) {
    throw new ValidationError("New password must be at least 6 characters");
  }

  const record = await AdminResetOtp.findOne({ email: normalizedEmail });
  if (!record) {
    throw new AuthError("OTP not found or expired. Please request a new code.");
  }
  if (record.expiresAt < new Date()) {
    await record.deleteOne();
    throw new AuthError("OTP has expired. Please request a new code.");
  }
  if (record.attempts >= (config.otpMaxAttempts || 5)) {
    throw new AuthError("Too many attempts. Please request a new code.");
  }
  record.attempts += 1;
  if (record.otp !== otpStr) {
    await record.save();
    throw new AuthError("Invalid OTP.");
  }

  const admin = await FoodAdmin.findOne({ email: normalizedEmail });
  if (!admin) {
    await record.deleteOne();
    throw new AuthError("Account not found.");
  }

  admin.password = newPassword;
  await admin.save();
  await record.deleteOne();

  try {
    const { notifyAdminsSafely } = await import("../../core/notifications/firebase.service.js");
    void notifyAdminsSafely({
      title: "Security Alert: Password Reset Successful 🔐",
      body: `The password for admin account ${admin.email} has been reset via OTP.`,
      data: {
        type: "security_alert",
        subType: "password_reset",
        email: admin.email
      }
    });
  } catch (e) {
    console.error("Failed to notify admins of password reset:", e);
  }

  return { success: true, message: "Password reset successfully." };
};

export const refreshAccessToken = async (token) => {
  if (!token) {
    throw new ValidationError("Refresh token is required");
  }

  const stored = await FoodRefreshToken.findOne({ token }).lean();
  if (!stored) {
    throw new AuthError("Invalid refresh token");
  }

  const jwt = await import("jsonwebtoken");
  let payload;
  try {
    payload = jwt.default.verify(token, config.jwtRefreshSecret);
  } catch {
    throw new AuthError("Invalid refresh token");
  }

  // If deactivated user, do not issue fresh access tokens (forces logout on client)
  if (payload?.role === "USER") {
    const u = await FoodUser.findById(payload.userId).select("isActive").lean();
    if (!u || u.isActive === false) {
      throw new AuthError("User account is deactivated");
    }
  }

  const newAccessToken = signAccessToken({
    userId: payload.userId,
    role: payload.role,
  });

  return { accessToken: newAccessToken, refreshToken: token };
};
