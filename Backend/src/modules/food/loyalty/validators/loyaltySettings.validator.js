import { z } from 'zod';
import { ValidationError } from '../../../../core/auth/errors.js';

const schema = z.object({
    pointsPerRupee: z.number().min(0).optional(),
    pointsPerRupeeRedemption: z.number().min(1).optional(),
    minOrderValueToEarn: z.number().min(0).optional(),
    minPointsToRedeem: z.number().min(0).optional(),
    maxRedeemPercentPerOrder: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional()
});

export const validateLoyaltySettingsUpsertDto = (body) => {
    const normalized = {
        pointsPerRupee: body?.pointsPerRupee !== undefined ? Number(body.pointsPerRupee) : undefined,
        pointsPerRupeeRedemption: body?.pointsPerRupeeRedemption !== undefined ? Number(body.pointsPerRupeeRedemption) : undefined,
        minOrderValueToEarn: body?.minOrderValueToEarn !== undefined ? Number(body.minOrderValueToEarn) : undefined,
        minPointsToRedeem: body?.minPointsToRedeem !== undefined ? Number(body.minPointsToRedeem) : undefined,
        maxRedeemPercentPerOrder: body?.maxRedeemPercentPerOrder !== undefined ? Number(body.maxRedeemPercentPerOrder) : undefined,
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : undefined
    };

    const result = schema.safeParse(normalized);
    if (!result.success) {
        throw new ValidationError(result.error.errors[0].message);
    }
    return result.data;
};
