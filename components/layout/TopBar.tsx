"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export interface BusinessItem {
  id: string;
  name: string;
  gstin: string;
  state_code: string;
  role: "admin" | "accountant" | "auditor";
}

export interface TopBarProps {
  currentBusiness?: BusinessItem;
  availableBusinesses?: BusinessItem[];
  userEmail?: string;
  userRole?: string;
  onSelectBusiness?: (businessId: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentBusiness = {
    id: "default-biz",
    name: "Alpha Retailers Pvt Ltd",
    gstin: "27AABCU9603R1ZM",
    state_code: "27",
    role: "admin",
  },
  availableBusinesses = [
    {
      id: "default-biz",
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
  ],
  userEmail = "accountant@alpha-retailers.in",
  userRole = "admin",
  onSelectBusiness,
}) => {
  const router = useRouter();
  const [isBizMenuOpen, setIsBizMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const bizMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        bizMenuRef.current &&
        !bizMenuRef.current.contains(event.target as Node)
      ) {
        setIsBizMenuOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: "/login" });
    } catch {
      router.push("/login");
    }
  };

  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "GL";

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-neutral-200 px-4 md:px-8 flex items-center justify-between">
      {/* Left: Mobile Brand & Business Switcher */}
      <div className="flex items-center gap-3">
        {/* Mobile Icon */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold font-mono text-sm">
            ₹
          </div>
        </div>

        {/* Business Switcher Dropdown */}
        <div className="relative" ref={bizMenuRef}>
          <button
            type="button"
            onClick={() => setIsBizMenuOpen(!isBizMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50/70 hover:bg-neutral-100/80 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <div className="max-w-[140px] sm:max-w-[200px] truncate">
              <div className="text-xs font-bold text-neutral-900 truncate">
                {currentBusiness.name}
              </div>
              <div className="text-[10px] font-mono text-neutral-500 truncate">
                {currentBusiness.gstin}
              </div>
            </div>
            <svg
              className={`w-4 h-4 text-neutral-400 transition-transform ${
                isBizMenuOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Business Switcher Dropdown Menu */}
          {isBizMenuOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-xl bg-white border border-neutral-200 shadow-dropdown py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Switch Business
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-neutral-50">
                {availableBusinesses.map((biz) => {
                  const isSelected = biz.id === currentBusiness.id;
                  return (
                    <button
                      key={biz.id}
                      type="button"
                      onClick={() => {
                        onSelectBusiness?.(biz.id);
                        setIsBizMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-neutral-50 transition-colors ${
                        isSelected ? "bg-brand-50/60" : ""
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div
                          className={`text-xs font-bold truncate ${
                            isSelected ? "text-brand-700" : "text-neutral-800"
                          }`}
                        >
                          {biz.name}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-500">
                          {biz.gstin} · State: {biz.state_code}
                        </div>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 uppercase">
                        {biz.role}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-neutral-100 pt-1 mt-1 px-2">
                <Link
                  href="/onboarding"
                  onClick={() => setIsBizMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span>Register New Business</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Quick Status & User Profile Menu */}
      <div className="flex items-center gap-3">
        {/* State Tag */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-600 text-xs font-medium">
          <span className="text-neutral-400">POS State:</span>
          <span className="font-mono font-bold text-neutral-800">
            {currentBusiness.state_code}
          </span>
        </div>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2.5 p-1 rounded-full hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <div className="w-8 h-8 rounded-full bg-brand-100 border border-brand-200 text-brand-700 flex items-center justify-center font-bold text-xs">
              {initials}
            </div>
            <div className="hidden lg:block text-left pr-1">
              <div className="text-xs font-semibold text-neutral-800 truncate max-w-[130px]">
                {userEmail}
              </div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                {userRole}
              </div>
            </div>
          </button>

          {/* User Dropdown Menu */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-neutral-200 shadow-dropdown py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-neutral-100">
                <p className="text-xs font-medium text-neutral-500">
                  Signed in as
                </p>
                <p className="text-xs font-bold text-neutral-900 truncate">
                  {userEmail}
                </p>
                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 uppercase">
                  Role: {userRole}
                </span>
              </div>

              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
                >
                  <svg
                    className="w-4 h-4 text-neutral-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>Business Settings</span>
                </Link>

                <Link
                  href="/settings/users"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
                >
                  <svg
                    className="w-4 h-4 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <span>User Management</span>
                </Link>
              </div>

              <div className="border-t border-neutral-100 pt-1">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-expense-600 hover:bg-expense-50 text-left"
                >
                  <svg
                    className="w-4 h-4 text-expense-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
