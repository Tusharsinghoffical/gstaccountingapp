import { prisma } from "@/lib/prisma";

export class ForbiddenError extends Error {
  statusCode: number;
  constructor(message: string = "Forbidden: Access denied to this business resource") {
    super(message);
    this.name = "ForbiddenError";
    this.statusCode = 403;
  }
}

export class UnauthorizedError extends Error {
  statusCode: number;
  constructor(message: string = "Unauthorized: Session missing or invalid") {
    super(message);
    this.name = "UnauthorizedError";
    this.statusCode = 401;
  }
}

export interface AuthSession {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
  } | null;
}

export type BusinessRole = "admin" | "accountant" | "auditor";

/**
 * Asserts that the given userId is an active member of the businessId.
 * Throws 403 ForbiddenError if not found or status is not 'active'.
 */
export async function assertBusinessMembership(userId: string, businessId: string) {
  if (!userId || !businessId) {
    throw new ForbiddenError("403: Forbidden - Missing userId or businessId");
  }

  const membership = await prisma.businessUser.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId,
      },
    },
    include: {
      business: true,
    },
  });

  if (!membership || membership.status !== "active") {
    throw new ForbiddenError(
      `403: Forbidden - User ${userId} is not an active member of business ${businessId}`
    );
  }

  return membership;
}

/**
 * Asserts that the given userId has one of the allowed roles in the businessId.
 * Throws 403 ForbiddenError if not a member or if role is not allowed.
 */
export async function assertRole(
  userId: string,
  businessId: string,
  allowedRoles: BusinessRole[]
) {
  const membership = await assertBusinessMembership(userId, businessId);

  if (!allowedRoles.includes(membership.role as BusinessRole)) {
    throw new ForbiddenError(
      `403: Forbidden - Role '${membership.role}' lacks permission. Allowed: ${allowedRoles.join(
        ", "
      )}`
    );
  }

  return membership;
}

/**
 * Extracts and validates userId from session.
 */
export function getSessionUserId(session: AuthSession | null | undefined): string {
  if (!session?.user?.id) {
    throw new UnauthorizedError("401: Unauthorized - Valid user session required");
  }
  return session.user.id;
}
