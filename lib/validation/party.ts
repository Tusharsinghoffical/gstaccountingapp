import { z } from "zod";
import { optionalGstinSchema } from "./gstin";

export const partyFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),
  gstin: optionalGstinSchema,
  state_code: z
    .string()
    .length(2, "State code must be 2 digits")
    .regex(/^[0-9]{2}$/, "State code must be numeric (e.g. 27 for Maharashtra)"),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Invalid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
  billing_address: z.string().optional().or(z.literal("")),
  shipping_address: z.string().optional().or(z.literal("")),
  pan: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format (e.g. AABCU9603R)")
    .optional()
    .or(z.literal("")),
});

export type PartyFormData = z.infer<typeof partyFormSchema>;
