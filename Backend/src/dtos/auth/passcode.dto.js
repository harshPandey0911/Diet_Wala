import { z } from "zod";
import { ValidationError } from "../../core/auth/errors.js";

const moduleSchema = z.enum(["user", "restaurant", "delivery"]);
const phoneSchema = z.string().transform((value) => value.replace(/\D/g, "").slice(-10)).refine((value) => /^\d{10}$/.test(value), "A valid 10-digit phone number is required");
const passcodeSchema = z.string().regex(/^\d{4}$/, "Passcode must be exactly 4 digits");

const validate = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError(result.error.errors[0].message);
  return result.data;
};

export const validatePasscodeStatusDto = (body) => validate(z.object({ module: moduleSchema, phone: phoneSchema }), body);
export const validatePasscodeLoginDto = (body) => validate(z.object({ module: moduleSchema, phone: phoneSchema, passcode: passcodeSchema }), body);
export const validatePasscodeUpdateDto = (body) => validate(z.object({
  newPasscode: passcodeSchema,
  confirmPasscode: passcodeSchema,
  currentPasscode: passcodeSchema.optional(),
}).refine((data) => data.newPasscode === data.confirmPasscode, { message: "Passcodes do not match", path: ["confirmPasscode"] }), body);
