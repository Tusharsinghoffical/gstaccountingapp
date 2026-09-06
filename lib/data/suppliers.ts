import { prisma } from "@/lib/prisma";
import {
  AuthSession,
  assertBusinessMembership,
  assertRole,
  getSessionUserId,
} from "@/lib/auth/authorize";

export interface SupplierInput {
  name: string;
  gstin?: string | null;
  stateCode: string;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  pan?: string | null;
  isActive?: boolean;
}

export async function getSuppliers(
  session: AuthSession,
  businessId: string,
  filter?: { isActive?: boolean; query?: string }
) {
  const userId = getSessionUserId(session);
  await assertBusinessMembership(userId, businessId);

  return prisma.supplier.findMany({
    where: {
      businessId,
      ...(filter?.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter?.query
        ? {
            OR: [
              { name: { contains: filter.query } },
              { gstin: { contains: filter.query } },
              { email: { contains: filter.query } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function getSupplierById(
  session: AuthSession,
  businessId: string,
  supplierId: string
) {
  const userId = getSessionUserId(session);
  await assertBusinessMembership(userId, businessId);

  return prisma.supplier.findFirst({
    where: { id: supplierId, businessId },
  });
}

export async function createSupplier(
  session: AuthSession,
  businessId: string,
  data: SupplierInput
) {
  const userId = getSessionUserId(session);
  await assertRole(userId, businessId, ["admin", "accountant"]);

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({
      data: {
        businessId,
        name: data.name,
        gstin: data.gstin || null,
        stateCode: data.stateCode,
        email: data.email || null,
        phone: data.phone || null,
        billingAddress: data.billingAddress || null,
        pan: data.pan || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    await tx.auditLog.create({
      data: {
        businessId,
        userId,
        action: "INSERT",
        tableName: "suppliers",
        recordId: supplier.id,
        diff: JSON.stringify({ name: supplier.name, gstin: supplier.gstin }),
      },
    });

    return supplier;
  });
}

export async function updateSupplier(
  session: AuthSession,
  businessId: string,
  supplierId: string,
  data: Partial<SupplierInput>
) {
  const userId = getSessionUserId(session);
  await assertRole(userId, businessId, ["admin", "accountant"]);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.supplier.findFirst({
      where: { id: supplierId, businessId },
    });

    if (!existing) {
      throw new Error("Supplier not found in this business");
    }

    const updated = await tx.supplier.update({
      where: { id: supplierId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.gstin !== undefined ? { gstin: data.gstin } : {}),
        ...(data.stateCode ? { stateCode: data.stateCode } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.billingAddress !== undefined ? { billingAddress: data.billingAddress } : {}),
        ...(data.pan !== undefined ? { pan: data.pan } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        businessId,
        userId,
        action: "UPDATE",
        tableName: "suppliers",
        recordId: supplierId,
        diff: JSON.stringify({ before: existing, after: updated }),
      },
    });

    return updated;
  });
}

export async function deleteSupplier(
  session: AuthSession,
  businessId: string,
  supplierId: string
) {
  const userId = getSessionUserId(session);
  await assertRole(userId, businessId, ["admin"]);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.supplier.findFirst({
      where: { id: supplierId, businessId },
    });

    if (!existing) {
      throw new Error("Supplier not found in this business");
    }

    await tx.supplier.delete({
      where: { id: supplierId },
    });

    await tx.auditLog.create({
      data: {
        businessId,
        userId,
        action: "DELETE",
        tableName: "suppliers",
        recordId: supplierId,
        diff: JSON.stringify(existing),
      },
    });

    return existing;
  });
}
