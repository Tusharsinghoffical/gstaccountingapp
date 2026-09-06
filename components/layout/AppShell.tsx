"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar, BusinessItem } from "./TopBar";
import { BottomNav } from "./BottomNav";

export interface AppShellProps {
  children: React.ReactNode;
  initialBusiness?: BusinessItem;
  availableBusinesses?: BusinessItem[];
  userEmail?: string;
  userRole?: "admin" | "accountant" | "auditor";
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  initialBusiness,
  availableBusinesses,
  userEmail,
  userRole,
}) => {
  const [activeBusiness, setActiveBusiness] = useState<BusinessItem | undefined>(
    initialBusiness
  );

  const handleSelectBusiness = (businessId: string) => {
    const found = availableBusinesses?.find((b) => b.id === businessId);
    if (found) {
      setActiveBusiness(found);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Desktop Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Layout Container */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Bar with Business Switcher & User Menu */}
        <TopBar
          currentBusiness={activeBusiness}
          availableBusinesses={availableBusinesses}
          userEmail={userEmail}
          userRole={userRole}
          onSelectBusiness={handleSelectBusiness}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-24 md:pb-12 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
          {children}
        </main>

        {/* Mobile Bottom Navigation (Collapses under 768px) */}
        <BottomNav />
      </div>
    </div>
  );
};
