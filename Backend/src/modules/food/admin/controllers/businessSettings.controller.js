import { FoodBusinessSettings } from '../models/businessSettings.model.js';
import { getAppAvailability, getZoneAppAvailability, isValidAppTime, ZONE_APP_FIELDS } from '../services/appAvailability.service.js';
import { FoodZone } from '../models/zone.model.js';

// Applies the app on/off hours fields from a request body onto the settings doc.
// Returns an error message when a time is malformed, otherwise null.
const applyAppHours = (settings, body) => {
    const { appTimingEnabled, appOpeningTime, appClosingTime, appClosedMessage } = body || {};
    if (appOpeningTime !== undefined && !isValidAppTime(appOpeningTime)) return 'App opening time must be in HH:mm format';
    if (appClosingTime !== undefined && !isValidAppTime(appClosingTime)) return 'App closing time must be in HH:mm format';
    if (appTimingEnabled !== undefined) settings.appTimingEnabled = appTimingEnabled === true || appTimingEnabled === 'true';
    if (appOpeningTime !== undefined) settings.appOpeningTime = String(appOpeningTime).trim();
    if (appClosingTime !== undefined) settings.appClosingTime = String(appClosingTime).trim();
    if (appClosedMessage !== undefined) settings.appClosedMessage = String(appClosedMessage || '').trim().slice(0, 200);
    return null;
};
import { clearRazorpayDisabledCache } from '../../orders/helpers/razorpay.helper.js';
import { sendResponse } from '../../../../utils/response.js';
import { uploadGenericImage, uploadFileBuffer } from '../../../../services/upload.service.js';

export async function getBusinessSettings(req, res, next) {
    try {
        let settings = await FoodBusinessSettings.findOne().lean();
        if (!settings) {
            // Create default settings if none exist
            settings = await FoodBusinessSettings.create({
                companyName: 'DietVala',
                email: 'admin@dietvala.com'
            });
        }
        return sendResponse(res, 200, 'Business settings fetched successfully', { ...settings, appStatus: getAppAvailability(settings) });
    } catch (error) {
        next(error);
    }
}

export async function updateBusinessSettings(req, res, next) {
    try {
        // Safer data parsing that handles both JSON and multipart/form-data
        let data = {};
        try {
            if (req.body.data) {
                data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
            } else {
                data = req.body;
            }
        } catch (err) {
            return res.status(400).json({ success: false, message: 'Invalid data format' });
        }

        const {
            companyName, email, phoneCountryCode, phoneNumber, address, state, pincode, region,
            supportEmail, supportPhone, supportHours,
            userSupportPhone, restaurantSupportPhone, deliverySupportPhone,
            fssai, gstin, onlinePaymentOnly, razorpayDisabled, maxCodAmount,
            maintenanceMode, northeastUserPreview, customerRegistration, restaurantRegistration, deliveryRegistration
        } = data;

        // Ensure string inputs for validation to prevent crashes from non-string values
        const s_companyName = String(companyName || "").trim();
        const s_email = String(email || "").trim();
        const s_phoneNumber = String(phoneNumber || "").trim();
        const s_address = String(address || "").trim();
        const s_state = String(state || "").trim();
        const s_pincode = String(pincode || "").trim();
        const s_supportEmail = String(supportEmail || "").trim();
        const s_supportPhone = String(supportPhone || "").trim();
        const s_supportHours = String(supportHours || "").trim();
        const s_userSupportPhone = String(userSupportPhone || "").trim();
        const s_restaurantSupportPhone = String(restaurantSupportPhone || "").trim();
        const s_deliverySupportPhone = String(deliverySupportPhone || "").trim();
        const s_fssai = String(fssai || "").trim();
        const s_gstin = String(gstin || "").trim();

        // Validation (only if field is provided for partial updates)
        if (companyName !== undefined && (!s_companyName || s_companyName.length < 2 || s_companyName.length > 50)) {
            return res.status(400).json({ success: false, message: 'Company name must be between 2 and 50 characters' });
        }
        if (email !== undefined && (!s_email || s_email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s_email))) {
            return res.status(400).json({ success: false, message: 'Invalid email address (max 100 characters)' });
        }
        if (phoneNumber !== undefined && (!s_phoneNumber || !/^\d{7,15}$/.test(s_phoneNumber))) {
            return res.status(400).json({ success: false, message: 'Invalid phone number (7-15 digits required)' });
        }
        if (s_address && s_address.length > 250) {
            return res.status(400).json({ success: false, message: 'Address is too long (max 250 characters)' });
        }
        if (s_state && s_state.length > 50) {
            return res.status(400).json({ success: false, message: 'State name is too long (max 50 characters)' });
        }
        if (s_pincode && !/^\d{4,10}$/.test(s_pincode)) {
            return res.status(400).json({ success: false, message: 'Invalid pincode (4-10 digits required)' });
        }
        if (s_supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s_supportEmail)) {
            return res.status(400).json({ success: false, message: 'Invalid support email address' });
        }
        for (const [label, value] of [
            ['User support phone', s_userSupportPhone],
            ['Restaurant support phone', s_restaurantSupportPhone],
            ['Delivery support phone', s_deliverySupportPhone],
        ]) {
            if (value && !/^\d{7,15}$/.test(value.replace(/[\s+-]/g, ''))) {
                return res.status(400).json({ success: false, message: `${label} must be a valid phone number (7-15 digits)` });
            }
        }

        let settings = await FoodBusinessSettings.findOne();
        if (!settings) {
            settings = new FoodBusinessSettings();
        }

        if (s_companyName) settings.companyName = s_companyName;
        if (s_email) settings.email = s_email;
        if (phoneCountryCode || s_phoneNumber) {
            settings.phone = {
                countryCode: String(phoneCountryCode || settings.phone?.countryCode || '+91').trim(),
                number: s_phoneNumber || settings.phone?.number || ''
            };
        }
        if (address !== undefined) settings.address = s_address;
        if (state !== undefined) settings.state = s_state;
        if (pincode !== undefined) settings.pincode = s_pincode;
        if (region) settings.region = String(region).trim();
        
        if (supportEmail !== undefined) settings.supportEmail = s_supportEmail;
        if (supportPhone !== undefined) settings.supportPhone = s_supportPhone;
        if (supportHours !== undefined) settings.supportHours = s_supportHours;
        if (userSupportPhone !== undefined) settings.userSupportPhone = s_userSupportPhone;
        if (restaurantSupportPhone !== undefined) settings.restaurantSupportPhone = s_restaurantSupportPhone;
        if (deliverySupportPhone !== undefined) settings.deliverySupportPhone = s_deliverySupportPhone;
        if (fssai !== undefined) settings.fssai = s_fssai;
        if (gstin !== undefined) settings.gstin = s_gstin;
        
        if (onlinePaymentOnly !== undefined) {
            settings.onlinePaymentOnly = Boolean(onlinePaymentOnly === 'true' || onlinePaymentOnly === true);
        }
        
        if (razorpayDisabled !== undefined) {
            settings.razorpayDisabled = Boolean(razorpayDisabled === 'true' || razorpayDisabled === true);
        }

        if (maxCodAmount !== undefined) {
            settings.maxCodAmount = Number(maxCodAmount) || 0;
        }

        if (maintenanceMode !== undefined) {
            settings.maintenanceMode = Boolean(maintenanceMode === 'true' || maintenanceMode === true);
        }
        const appHoursError = applyAppHours(settings, data);
        if (appHoursError) return res.status(400).json({ success: false, message: appHoursError });
        if (northeastUserPreview !== undefined) {
            settings.northeastUserPreview = Boolean(northeastUserPreview === 'true' || northeastUserPreview === true);
        }
        if (customerRegistration !== undefined) {
            settings.customerRegistration = Boolean(customerRegistration === 'true' || customerRegistration === true);
        }
        if (restaurantRegistration !== undefined) {
            settings.restaurantRegistration = Boolean(restaurantRegistration === 'true' || restaurantRegistration === true);
        }
        if (deliveryRegistration !== undefined) {
            settings.deliveryRegistration = Boolean(deliveryRegistration === 'true' || deliveryRegistration === true);
        }

        // Handle file uploads
        if (req.files?.logo) {
            const logoUrl = await uploadGenericImage(req.files.logo[0].buffer, 'business/logos');
            settings.logo = { url: logoUrl, publicId: null };
        } else if (data.logo) {
            settings.logo = { url: String(data.logo).trim(), publicId: null };
        }

        if (req.files?.favicon) {
            const faviconUrl = await uploadGenericImage(req.files.favicon[0].buffer, 'business/favicons');
            settings.favicon = { url: faviconUrl, publicId: null };
        } else if (data.favicon) {
            settings.favicon = { url: String(data.favicon).trim(), publicId: null };
        }

        if (req.files?.termsAndConditionsPdf) {
            const pdfFile = req.files.termsAndConditionsPdf[0];
            const pdfUrl = await uploadFileBuffer(pdfFile.buffer, 'business/legal', {
                fileName: pdfFile.originalname,
                format: 'pdf'
            });
            settings.termsAndConditionsPdf = { url: pdfUrl, publicId: null };
        } else if (data.termsAndConditionsPdf) {
            settings.termsAndConditionsPdf = { url: String(data.termsAndConditionsPdf).trim(), publicId: null };
        }

        await settings.save();
        clearRazorpayDisabledCache();
        return sendResponse(res, 200, 'Business settings updated successfully', settings);
    } catch (error) {
        next(error);
    }
}

export async function updateBusinessToggles(req, res, next) {
    try {
        const {
            onlinePaymentOnly,
            razorpayDisabled,
            maxCodAmount,
            maintenanceMode,
            northeastUserPreview,
            customerRegistration,
            restaurantRegistration,
            deliveryRegistration,
        } = req.body || {};

        let settings = await FoodBusinessSettings.findOne();
        if (!settings) {
            settings = await FoodBusinessSettings.create({
                companyName: 'DietVala',
                email: 'admin@dietvala.com',
            });
        }

        if (onlinePaymentOnly !== undefined) {
            settings.onlinePaymentOnly = Boolean(onlinePaymentOnly);
        }
        if (razorpayDisabled !== undefined) {
            settings.razorpayDisabled = Boolean(razorpayDisabled);
        }
        if (maxCodAmount !== undefined) {
            settings.maxCodAmount = Number(maxCodAmount) || 0;
        }
        if (maintenanceMode !== undefined) {
            settings.maintenanceMode = Boolean(maintenanceMode);
        }
        const appHoursError = applyAppHours(settings, req.body);
        if (appHoursError) return res.status(400).json({ success: false, message: appHoursError });
        if (northeastUserPreview !== undefined) {
            settings.northeastUserPreview = Boolean(northeastUserPreview);
        }
        if (customerRegistration !== undefined) {
            settings.customerRegistration = Boolean(customerRegistration);
        }
        if (restaurantRegistration !== undefined) {
            settings.restaurantRegistration = Boolean(restaurantRegistration);
        }
        if (deliveryRegistration !== undefined) {
            settings.deliveryRegistration = Boolean(deliveryRegistration);
        }

        await settings.save();
        clearRazorpayDisabledCache();
        const plain = settings.toObject ? settings.toObject() : settings;
        const payload = { ...plain, appStatus: getAppAvailability(plain) };
        return sendResponse(res, 200, 'Toggle settings updated successfully', payload);
    } catch (error) {
        next(error);
    }
}

// ----- Zone-wise app ON/OFF -----
export async function listZoneAppStatus(req, res, next) {
    try {
        const zones = await FoodZone.find({ isActive: true }).select(ZONE_APP_FIELDS).sort({ name: 1 }).lean();
        const data = zones.map((zone) => ({
            _id: zone._id,
            name: zone.name,
            appManualOff: zone.appManualOff === true,
            appTimingEnabled: zone.appTimingEnabled === true,
            appOpeningTime: zone.appOpeningTime || '08:00',
            appClosingTime: zone.appClosingTime || '23:00',
            appClosedMessage: zone.appClosedMessage || '',
            orderingPaused: zone.orderingPaused === true,
            orderingPausedMessage: zone.orderingPausedMessage || '',
            appStatus: getZoneAppAvailability(zone)
        }));
        return sendResponse(res, 200, 'Zone app status fetched successfully', { zones: data });
    } catch (error) {
        next(error);
    }
}

export async function updateZoneAppStatus(req, res, next) {
    try {
        const zone = await FoodZone.findById(req.params.id);
        if (!zone) return res.status(404).json({ success: false, message: 'Zone not found' });

        const { appManualOff, appTimingEnabled, appOpeningTime, appClosingTime, appClosedMessage, orderingPaused, orderingPausedMessage } = req.body || {};
        if (appOpeningTime !== undefined && !isValidAppTime(appOpeningTime)) {
            return res.status(400).json({ success: false, message: 'App opening time must be in HH:mm format' });
        }
        if (appClosingTime !== undefined && !isValidAppTime(appClosingTime)) {
            return res.status(400).json({ success: false, message: 'App closing time must be in HH:mm format' });
        }
        if (appManualOff !== undefined) zone.appManualOff = appManualOff === true || appManualOff === 'true';
        if (appTimingEnabled !== undefined) zone.appTimingEnabled = appTimingEnabled === true || appTimingEnabled === 'true';
        if (appOpeningTime !== undefined) zone.appOpeningTime = String(appOpeningTime).trim();
        if (appClosingTime !== undefined) zone.appClosingTime = String(appClosingTime).trim();
        if (appClosedMessage !== undefined) zone.appClosedMessage = String(appClosedMessage || '').trim().slice(0, 200);
        if (orderingPaused !== undefined) zone.orderingPaused = orderingPaused === true || orderingPaused === 'true';
        if (orderingPausedMessage !== undefined) zone.orderingPausedMessage = String(orderingPausedMessage || '').trim().slice(0, 200);

        await zone.save();
        return sendResponse(res, 200, 'Zone app status updated successfully', {
            _id: zone._id,
            name: zone.name,
            appManualOff: zone.appManualOff,
            appTimingEnabled: zone.appTimingEnabled,
            appOpeningTime: zone.appOpeningTime,
            appClosingTime: zone.appClosingTime,
            appClosedMessage: zone.appClosedMessage,
            orderingPaused: zone.orderingPaused === true,
            orderingPausedMessage: zone.orderingPausedMessage || '',
            appStatus: getZoneAppAvailability(zone.toObject())
        });
    } catch (error) {
        next(error);
    }
}
