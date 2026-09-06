"use client";

/**
 * useStorageMode — React hook for hybrid Supabase + localStorage storage
 * ============================================================================
 * Returns the current storage mode and provides helpers to:
 *  - Detect when Supabase is offline and switch to localStorage
 *  - Show the offline mode banner
 *  - Export local data as JSON (for backup)
 *  - Re-check connectivity (for the "retry" button)
 *
 * Usage:
 *   const { isOnline, isChecking, mode, retryConnection, exportLocalData } = useStorageMode();
 */

import { useState, useEffect, useCallback } from "react";
import {
  isSupabaseOnline,
  invalidateConnectionCache,
} from "@/lib/storage/supabase-check";
import { LocalDB } from "@/lib/storage/local-db";

export type StorageMode = "supabase" | "local" | "checking";

export function useStorageMode() {
  const [mode, setMode] = useState<StorageMode>("checking");
  const [isChecking, setIsChecking] = useState(true);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    setMode("checking");
    const online = await isSupabaseOnline();
    setMode(online ? "supabase" : "local");
    setIsChecking(false);
    // Initialize localStorage seed data regardless of mode
    LocalDB.init();
  }, []);

  useEffect(() => {
    checkConnection();

    // Re-check when browser comes back online
    const handleOnline = () => {
      invalidateConnectionCache();
      checkConnection();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", () => {
      setMode("local");
      setIsChecking(false);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [checkConnection]);

  const retryConnection = useCallback(() => {
    invalidateConnectionCache();
    checkConnection();
  }, [checkConnection]);

  const exportLocalData = useCallback(() => {
    const json = LocalDB.exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gst-ledger-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    mode,
    isOnline: mode === "supabase",
    isOffline: mode === "local",
    isChecking,
    retryConnection,
    exportLocalData,
  };
}
