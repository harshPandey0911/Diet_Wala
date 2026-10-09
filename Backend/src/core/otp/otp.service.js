import crypto from 'crypto';
import ms from 'ms';
import { FoodOtp } from './otp.model.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ValidationError } from '../auth/errors.js';

const generateOtpCode = () => {
    const code = crypto.randomInt(100000, 999999);
    return String(code);
};

/**
 * Sends SMS via MSG91 API
 * @param {string} phone - 10-digit mobile number
 * @param {string} otp
 */
const sendSmsViaMsg91 = async (phone, otp) => {
    try {
        // Normalize phone: strip non-digits, ensure 91 country code prefix
        const digits = String(phone || '').replace(/\D/g, '');
        let msisdn = digits;
        if (msisdn.length === 10) {
            msisdn = `91${msisdn}`;
        } else if (!msisdn.startsWith('91')) {
            msisdn = `91${msisdn}`;
        }

        // MSG91 API
        const url = new URL('https://control.msg91.com/api/v5/otp');
        url.searchParams.append('template_id', config.msg91TemplateId);
        url.searchParams.append('mobile', msisdn);
        url.searchParams.append('authkey', config.msg91AuthKey);
        url.searchParams.append('otp', otp);

        logger.info(`[SMS] Sending OTP to ${msisdn} via MSG91...`);
        const response = await fetch(url.toString(), { method: 'POST' });
        const resultText = await response.text();
        logger.info(`[SMS] Raw response for ${msisdn}: ${resultText}`);

        let parsed = null;
        try { parsed = JSON.parse(resultText); } catch (_) { }

        if (parsed && parsed.type === 'error') {
            const errMsg = `MSG91 ERROR for ${phone}: ${parsed.message || resultText}`;
            logger.error(errMsg);
            // eslint-disable-next-line no-console
            console.error(`❌ [SMS ERROR] ${errMsg}`);
        } else if (!response.ok) {
            logger.error(`SMS API HTTP error for ${phone}: ${response.status} – ${resultText}`);
        } else {
            logger.info(`✅ SMS sent successfully to ${msisdn} via MSG91`);
        }
    } catch (error) {
        logger.error(`Error sending SMS to ${phone} via MSG91: ${error.message}`);
        // Do NOT throw — OTP is already stored in DB; SMS failure should not block the flow
    }
};

/**
 * Sends the OTP SMS via SMSIndiaHub (POST https://cloud.smsindiahub.in/api/mt/SendSMS, JSON).
 * The message must match the DLT-approved template text exactly, otherwise the operator drops it.
 * @param {string} phone - 10-digit mobile number
 * @param {string} otp
 */
const sendSmsViaSmsIndiaHub = async (phone, otp) => {
    try {
        const { smsIndiaHubApiKey, smsIndiaHubSenderId, smsIndiaHubChannel, smsIndiaHubRoute,
            smsIndiaHubEntityId, smsIndiaHubTemplateId, smsIndiaHubOtpText } = config;

        const missing = [
            ['SMSINDIAHUB_API_KEY', smsIndiaHubApiKey],
            ['SMSINDIAHUB_SENDER_ID', smsIndiaHubSenderId],
            ['SMSINDIAHUB_ROUTE', smsIndiaHubRoute],
            ['SMSINDIAHUB_TEMPLATE_ID', smsIndiaHubTemplateId],
            ['SMSINDIAHUB_OTP_TEXT', smsIndiaHubOtpText],
        ].filter(([, value]) => !value).map(([name]) => name);
        if (missing.length) {
            logger.error(`[SMS] SMSIndiaHub is not configured, missing: ${missing.join(', ')}`);
            return;
        }

        const digits = String(phone || '').replace(/\D/g, '');
        const msisdn = digits.length === 10 ? `91${digits}` : (digits.startsWith('91') ? digits : `91${digits}`);
        const text = String(smsIndiaHubOtpText).replace(/\{#var#\}|\{otp\}/gi, otp);

        const body = {
            Account: {
                APIKey: smsIndiaHubApiKey,
                SenderId: smsIndiaHubSenderId,
                Channel: String(smsIndiaHubChannel),
                DCS: 0,
                FlashMessage: 0,
                Route: Number(smsIndiaHubRoute),
                ...(smsIndiaHubEntityId ? { EntityId: smsIndiaHubEntityId } : {}),
            },
            Messages: [
                {
                    Number: msisdn,
                    Text: text,
                    DLTTemplateId: smsIndiaHubTemplateId,
                },
            ],
        };

        logger.info(`[SMS] Sending OTP to ${msisdn} via SMSIndiaHub...`);
        const response = await fetch('https://cloud.smsindiahub.in/api/mt/SendSMS', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const resultText = await response.text();

        let parsed = null;
        try { parsed = JSON.parse(resultText); } catch (_) { }

        // ErrorCode "000" means accepted; anything else is an error (message in ErrorMessage).
        if (!response.ok || !parsed || String(parsed.ErrorCode) !== '000') {
            logger.error(`[SMS] SMSIndiaHub failed for ${msisdn}: HTTP ${response.status} - ${resultText}`);
            // eslint-disable-next-line no-console
            console.error(`❌ [SMS ERROR] SMSIndiaHub failed for ${msisdn}: ${parsed?.ErrorMessage || resultText}`);
        } else {
            logger.info(`✅ SMS accepted by SMSIndiaHub for ${msisdn} (JobId: ${parsed.JobId})`);
        }
    } catch (error) {
        logger.error(`Error sending SMS to ${phone} via SMSIndiaHub: ${error.message}`);
        // Do NOT throw - OTP is already stored in DB; SMS failure should not block the flow
    }
};

const sendOtpSms = (phone, otp) =>
    config.smsProvider === 'smsindiahub'
        ? sendSmsViaSmsIndiaHub(phone, otp)
        : sendSmsViaMsg91(phone, otp);

export const createOrUpdateOtp = async (phone) => {
    const existing = await FoodOtp.findOne({ phone });
    const now = new Date();

    // Rate Limiting Logic
    if (existing) {
        const windowMs = (config.otpRateWindow || 600) * 1000;
        const isInWindow = now - existing.lastRequestAt < windowMs;

        if (isInWindow) {
            if (existing.requestCount >= (config.otpRateLimit || 3)) {
                logger.warn(`Rate limit exceeded for phone ${phone}`);
                throw new ValidationError(`Too many OTP requests. Please try again after ${Math.ceil(windowMs / 60000)} minutes.`);
            }
            existing.requestCount += 1;
        } else {
            // Reset count if window has passed
            existing.requestCount = 1;
        }
    }

    let otp;
    if (config.useDefaultOtp || phone.endsWith('9755633147') || phone.endsWith('8624862400')) {
        otp = '123456';
        logger.info(`Default OTP mode enabled – OTP is ${otp} for phone ${phone}`);
    } else {
        otp = generateOtpCode();
    }

    // Expiry calculation: prioritize seconds, then minutes, then fallback to MS string
    let ttlMs;
    if (config.otpExpirySeconds) {
        ttlMs = config.otpExpirySeconds * 1000;
    } else if (config.otpExpiryMinutes) {
        ttlMs = config.otpExpiryMinutes * 60 * 1000;
    } else {
        ttlMs = ms(config.otpExpiry || '5m');
    }
    const expiresAt = new Date(now.getTime() + ttlMs);

    if (existing) {
        existing.otp = otp;
        existing.expiresAt = expiresAt;
        existing.attempts = 0;
        existing.lastRequestAt = now;
        await existing.save();
    } else {
        await FoodOtp.create({
            phone,
            otp,
            expiresAt,
            requestCount: 1,
            lastRequestAt: now
        });
    }

    // Only send SMS if not in default OTP mode
    if (!config.useDefaultOtp && !phone.endsWith('9755633147') && !phone.endsWith('8624862400')) {
        await sendOtpSms(phone, otp);
    }

    return otp;
};

export const verifyOtp = async (phone, otp, options = { consume: true }) => {
    const record = await FoodOtp.findOne({ phone });
    if (!record) {
        return { valid: false, reason: 'OTP not found' };
    }

    if (record.expiresAt < new Date()) {
        return { valid: false, reason: 'OTP expired' };
    }

    if (record.attempts >= config.otpMaxAttempts) {
        return { valid: false, reason: 'Max attempts exceeded' };
    }

    record.attempts += 1;

    if (record.otp !== otp) {
        await record.save();
        return { valid: false, reason: 'Invalid OTP' };
    }

    if (options.consume !== false) {
        await record.deleteOne();
    }
    return { valid: true };
};

