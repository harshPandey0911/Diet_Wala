/**
 * Demo / QA accounts that sign in with a fixed OTP and never use a passcode.
 *
 * These exist so a known phone number can always be signed into — app-store review,
 * a support walkthrough, a demo — without waiting on a real SMS. Unlike the global
 * `USE_DEFAULT_OTP` switch (development only), this applies in production too, so it is
 * deliberately limited to an explicit list of numbers.
 *
 * For a listed number:
 *   - the OTP is always TEST_OTP_CODE and no SMS is sent,
 *   - that code is accepted even if no OTP was requested first,
 *   - OTP request rate limiting is skipped (the code is fixed, so throttling only locks
 *     the tester out),
 *   - and in the modules listed below the passcode is switched off: the login screen goes
 *     straight to OTP, passcode login is refused, and the app never asks to set one.
 *
 * Anything not listed here is completely unaffected.
 *
 * The list can be overridden without a deploy via the TEST_OTP_PHONES env var
 * (comma-separated 10-digit numbers), e.g. TEST_OTP_PHONES=7879363299,9876543210
 */

/** The OTP that always works for the numbers below. */
export const TEST_OTP_CODE = '123456';

const DEFAULT_TEST_PHONES = ['7879363299'];

/**
 * Modules where these accounts skip the passcode entirely.
 * 'delivery' is intentionally absent: delivery partners on a listed number keep their
 * passcode login (they still get the fixed OTP if they choose the OTP route).
 */
const PASSCODE_DISABLED_MODULES = new Set(['user', 'restaurant']);

const toLast10 = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

const parsePhoneList = (raw) =>
    String(raw || '')
        .split(',')
        .map((entry) => toLast10(entry))
        .filter((entry) => /^\d{10}$/.test(entry));

const envPhones = parsePhoneList(process.env.TEST_OTP_PHONES);
const TEST_PHONES = new Set(envPhones.length ? envPhones : DEFAULT_TEST_PHONES.map(toLast10));

/** True when this phone number should use the fixed OTP instead of a real one. */
export const isTestOtpPhone = (phone) => {
    const normalized = toLast10(phone);
    return /^\d{10}$/.test(normalized) && TEST_PHONES.has(normalized);
};

/** True when the passcode is switched off for this account (module + phone). */
export const isPasscodeDisabledForTestAccount = (moduleName, phone) =>
    PASSCODE_DISABLED_MODULES.has(String(moduleName || '')) && isTestOtpPhone(phone);

/** The numbers currently treated as test accounts — for logging and admin display. */
export const listTestOtpPhones = () => [...TEST_PHONES];
