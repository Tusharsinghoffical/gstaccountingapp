"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export interface RegisterUserInput {
  email: string;
  password: string;
  name?: string;
  businessName: string;
  gstin: string;
  stateCode: string;
}

export async function registerUser(input: RegisterUserInput) {
  const email = input.email.toLowerCase().trim();

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    return { error: "An account with this email already exists." };
  }

  // Hash password with bcrypt
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: input.name || null,
        },
      });

      // 2. Create primary Business
      const business = await tx.business.create({
        data: {
          name: input.businessName,
          gstin: input.gstin.toUpperCase().trim(),
          stateCode: input.stateCode,
          email,
        },
      });

      // 3. Assign as Admin
      const businessUser = await tx.businessUser.create({
        data: {
          businessId: business.id,
          userId: user.id,
          role: "admin",
          status: "active",
        },
      });

      return { user, business, businessUser };
    });

    return { success: true, userId: result.user.id, businessId: result.business.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to register user" };
  }
}
