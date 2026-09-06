import { prisma } from "@/lib/prisma";
import {
  AuthSession,
  assertBusinessMembership,
  assertRole,
  getSessionUserId,
} from "@/lib/auth/authorize";

export interface CustomerInput {
  name: string;
  gstin?: string | null;
  stateCode: string;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  pan?: string | null;
  isActive?: boolean;
}

export async function getCustomers(
  session: AuthSession,
  businessId: string,
  filter?: { isActive?: boolean; query?: string }
) {
  const userId = getSessionUserId(session);
  await assertBusinessMembership(userId, businessId);

  return prisma.customer.findMany({
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

export async function getCustomerById(
  session: AuthSession,
  businessId: string,
  customerId: string
) {
  const userId = getSessionUserId(session);
  await assertBusinessMembership(userId, businessId);

  return prisma.customer.findFirst({
    where: { id: customerId, businessId },
  });
}

export async function createCustomer(
  session: AuthSession,
  businessId: string,
  data: CustomerInput
) {
  const userId = getSessionUserId(session);
  await assertRole(userId, businessId, ["admin", "accountant"]);

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        businessId,
        name: data.name,
        gstin: data.gstin || null,
        stateCode: data.stateCode,
        email: data.email || null,
        phone: data.phone || null,
        billingAddress: data.billingAddress || null,
        shippingAddress: data.shippingAddress || null,
        pan: data.pan || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    await tx.auditLog.create({
      data: {
        businessId,
        userId,
        action: "INSERT",
        tableName: "customers",
        recordId: customer.id,
        diff: JSON.stringify({ name: customer.name, gstin: customer.gstin }),
      },
    });

    return customer;
  });
}

export async function updateCustomer(
  session: AuthSession,
  businessId: string,
  customerId: string,
  data: Partial<CustomerInput>
) {
  const userId = getSessionUserId(session);
  await assertRole(userId, businessId, ["admin", "accountant"]);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.customer.findFirst({
      where: { id: customerId, businessId },
    });

    if (!existing) {
      throw new Error("Customer not found in this business");
    }

    const updated = await tx.customer.update({
      where: { id: customerId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.gstin !== undefined ? { gstin: data.gstin } : {}),
        ...(data.stateCode ? { stateCode: data.stateCode } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.billingAddress !== undefined ? { billingAddress: data.billingAddress } : {}),
        ...(data.shippingAddress !== undefined ? { shippingAddress: data.shippingAddress } : {}),
        ...(data.pan !== undefined ? { pan: data.pan } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        businessId,
        userId,
        action: "UPDATE",
        tableName: "customers",
        recordId: customerId,
        diff: JSON.stringify({ before: existing, after: updated }),
      },
    });

    return updated;
  });
}

export async function deleteCustomer(
  session: AuthSession,
  businessId: string,
  customerId: string
) {
  const userId = getSessionUserId(session);
  await assertRole(userId, businessId, ["admin"]);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.customer.findFirst({
      where: { id: customerId, businessId },
    });

    if (!existing) {
      throw new Error("Customer not found in this business");
    }

    await tx.customer.delete({
      where: { id: customerId },
    });

    await tx.auditLog.create({
      data: {
        businessId,
        userId,
        action: "DELETE",
        tableName: "customers",
        recordId: customerId,
        diff: JSON.stringify(existing),
      },
    });

    return existing;
  });
}
