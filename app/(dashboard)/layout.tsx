import React from "react";
import { AppShell } from "@/components/layout";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    redirect("/login");
  }

  const userId = (session.user as any).id;
  const memberships = await prisma.businessUser.findMany({
    where: { userId, status: "active" },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  });

  if (!memberships || memberships.length === 0) {
    redirect("/onboarding");
  }

  const availableBusinesses = memberships.map((m) => ({
    id: m.businessId,
    name: m.business.name,
    gstin: m.business.gstin || "",
    state_code: m.business.stateCode,
    role: m.role as "admin" | "accountant" | "auditor",
  }));

  const initialBusiness = availableBusinesses[0];

  return (
    <AppShell
      initialBusiness={initialBusiness}
      availableBusinesses={availableBusinesses}
      userEmail={session.user.email || ""}
      userRole={initialBusiness.role}
    >
      {children}
    </AppShell>
  );
}
