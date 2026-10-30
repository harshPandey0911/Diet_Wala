import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const phoneSchema = z
    .string()
    .min(8, 'Phone must be at least 8 digits')
    .max(15, 'Phone must be at most 15 digits');

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const aadharRegex = /^[0-9]{12}$/;
const drivingLicenseRegex = /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/;
const bankAccountRegex = /^[0-9]{9,18}$/;
const ifscRegex = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;

const deliveryRegisterSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    phone: phoneSchema,
    email: z.string().email().optional().or(z.literal('')),
    countryCode: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    vehicleType: z.string().optional(),
    vehicleName: z.string().optional(),
    vehicleNumber: z.string().optional(),
    drivingLicenseNumber: z
        .string()
        .regex(drivingLicenseRegex, 'Invalid driving license format')
        .optional()
        .or(z.literal('')),
    ref: z.string().trim().max(64).optional().or(z.literal('')),
    // Bank details are mandatory at signup (payouts/withdrawals need them).
    bankAccountHolderName: z.string({ required_error: 'Account holder name is required' }).trim().min(1, 'Account holder name is required').max(100),
    bankAccountNumber: z
        .string({ required_error: 'Bank account number is required' })
        .trim()
        .regex(bankAccountRegex, 'Enter a valid bank account number (9-18 digits)'),
    bankIfscCode: z
        .string({ required_error: 'IFSC code is required' })
        .trim()
        .regex(ifscRegex, 'Enter a valid IFSC code (e.g. SBIN0001234)'),
    bankName: z.string({ required_error: 'Bank name is required' }).trim().min(1, 'Bank name is required').max(100),
    panNumber: z
        .string()
        .regex(panRegex, 'Invalid PAN format')
        .optional()
        .or(z.literal('')),
    aadharNumber: z
        .string()
        .regex(aadharRegex, 'Invalid Aadhar format')
        .optional()
        .or(z.literal('')),
    fcmToken: z.string().optional().nullable(),
    platform: z.enum(['web', 'mobile']).optional().default('web')
});

export const validateDeliveryRegisterDto = (body) => {
    const result = deliveryRegisterSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

const deliveryProfileUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    countryCode: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    vehicleType: z.string().optional(),
    vehicleName: z.string().optional(),
    vehicleNumber: z.string().optional(),
    drivingLicenseNumber: z
        .string()
        .regex(drivingLicenseRegex, 'Invalid driving license format')
        .optional()
        .or(z.literal('')),
    bankAccountHolderName: z.string().trim().max(100).optional(),
    bankAccountNumber: z.string().trim().regex(bankAccountRegex, 'Enter a valid bank account number (9-18 digits)').optional().or(z.literal('')),
    bankIfscCode: z.string().trim().regex(ifscRegex, 'Enter a valid IFSC code (e.g. SBIN0001234)').optional().or(z.literal('')),
    bankName: z.string().trim().max(100).optional(),
    fcmToken: z.string().optional().nullable(),
    platform: z.enum(['web', 'mobile']).optional().default('web')
});

export const validateDeliveryProfileUpdateDto = (body) => {
    const result = deliveryProfileUpdateSchema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

const bankDetailsSchema = z.object({
    accountHolderName: z.string().min(1, 'Account holder name is required').optional().or(z.literal('')),
    accountNumber: z.string().min(1, 'Account number is required').optional().or(z.literal('')),
    ifscCode: z.string().min(1, 'IFSC code is required').optional().or(z.literal('')),
    bankName: z.string().min(1, 'Bank name is required').optional().or(z.literal('')),
    upiId: z.string().optional().or(z.literal('')),
    upiQrCode: z.string().optional().or(z.literal(''))
});

const bankDetailsUpdateSchema = z.object({
    documents: z.object({
        bankDetails: bankDetailsSchema.optional(),
        pan: z.object({ number: z.string().optional() }).optional()
    }).optional()
}).optional();

export const validateDeliveryBankDetailsDto = (body) => {
    // If we have flat keys from FormData (multer), reconstruct the nested object for Zod
    const processed = { ...body };
    if (!processed.documents) processed.documents = {};
    if (!processed.documents.bankDetails) {
        processed.documents.bankDetails = {
            accountHolderName: body['documents[bankDetails][accountHolderName]'],
            accountNumber: body['documents[bankDetails][accountNumber]'],
            ifscCode: body['documents[bankDetails][ifscCode]'],
            bankName: body['documents[bankDetails][bankName]'],
            upiId: body['documents[bankDetails][upiId]']
        };
    }
    if (!processed.documents.pan && body['documents[pan][number]']) {
        processed.documents.pan = { number: body['documents[pan][number]'] };
    }

    const result = bankDetailsUpdateSchema.safeParse(processed);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};

