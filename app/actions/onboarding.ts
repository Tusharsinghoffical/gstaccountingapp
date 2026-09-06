"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";
import { validateGSTIN } from "@/lib/validation/gstin";

const onboardingSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters").max(100),
  gstin: z.string().min(15, "GSTIN must be 15 characters").max(15),
  address: z.string().max(255).optional(),
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;

export async function completeOnboarding(
  formData: OnboardingFormData
): Promise<{ success: boolean; businessId?: string; error?: string }> {
  // 1. Enforce authenticated user session
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as any).id) {
    return { success: false, error: "Unauthorized. Please sign in to create a business." };
  }
  const userId = (session.user as any).id;

  // 2. Validate input schema
  const parsed = onboardingSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid business details.",
    };
  }

  // 3. Strict GSTIN format + Mod-36 Luhn Checksum validation
  const gstinCheck = validateGSTIN(parsed.data.gstin);
  if (!gstinCheck.isValid || !gstinCheck.stateCode) {
    return {
      success: false,
      error: gstinCheck.error || "Invalid GSTIN format or checksum mismatch.",
    };
  }

  const cleanGstin = parsed.data.gstin.trim().toUpperCase();

  // 4. Create Business and assign current user as admin
  try {
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: parsed.data.name.trim(),
          gstin: cleanGstin,
          stateCode: gstinCheck.stateCode!,
          address: parsed.data.address?.trim() || null,
        },
      });

      await tx.businessUser.create({
        data: {
          businessId: business.id,
          userId,
          role: "admin",
          status: "active",
        },
      });

      await tx.auditLog.create({
        data: {
          businessId: business.id,
          userId,
          action: "INSERT",
          tableName: "businesses",
          recordId: business.id,
          diff: JSON.stringify({
            name: business.name,
            gstin: business.gstin,
            stateCode: business.stateCode,
          }),
        },
      });

      return business;
    });

    return { success: true, businessId: result.id };
  } catch (err: unknown) {
    console.error("Failed to complete onboarding:", err);
    return {
      success: false,
      error: "Unable to create business. Please try again.",
    };
  }
}
