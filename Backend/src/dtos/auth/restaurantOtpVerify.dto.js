import { z } from 'zod';
import { ValidationError } from '../../core/auth/errors.js';

const schema = z.object({
    phone: z
        .string()
        .min(8, 'Phone must be at least 8 digits')
        .max(15, 'Phone must be at most 15 digits'),
    otp: z
        .string()
        .length(6, 'OTP must be exactly 6 digits'),
    fcmToken: z.string().optional().nullable(),
    platform: z.enum(['web', 'mobile']).optional().default('web'),
    purpose: z.enum(['login', 'register', 'passcode_setup', 'passcode_reset']).optional().default('login')
});

export const validateRestaurantOtpVerifyDto = (body) => {
    const result = schema.safeParse(body);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};
