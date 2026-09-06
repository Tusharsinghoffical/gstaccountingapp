import React from "react";
import { AppShell } from "@/components/layout";
import { OfflineBanner } from "@/components/ui";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell
      initialBusiness={{
        id: "biz-1",
        name: "Alpha Retailers Pvt Ltd",
        gstin: "27AABCU9603R1ZM",
        state_code: "27",
        role: "admin",
      }}
      availableBusinesses={[
        {
          id: "biz-1",
          name: "Alpha Retailers Pvt Ltd",
          gstin: "27AABCU9603R1ZM",
          state_code: "27",
          role: "admin",
        },
        {
          id: "biz-2",
          name: "Krishna Textiles & Garments",
          gstin: "29AABCU9603R1ZK",
          state_code: "29",
          role: "accountant",
        },
      ]}
      userEmail="accountant@alpha-retailers.in"
      userRole="admin"
    >
      <OfflineBanner />
      {children}
    </AppShell>
  );
}
