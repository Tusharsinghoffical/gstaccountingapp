"use client";

import { useStorageMode } from "@/lib/storage/use-storage-mode";

/**
 * OfflineBanner
 * ============================================================================
 * Shows a prominent banner when the app is operating in offline / localStorage
 * mode. Includes:
 *  - Storage mode indicator (Supabase connected vs Local Storage)
 *  - Retry button to re-check Supabase connectivity
 *  - Export button to download all local data as JSON backup
 *  - A "checking" state while the connection probe is in-flight
 */
export function OfflineBanner() {
  const { mode, isChecking, retryConnection, exportLocalData } = useStorageMode();

  // Don't render anything while checking or when Supabase is connected
  if (isChecking || mode === "supabase") return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 9999,
        background: "linear-gradient(90deg, #b45309 0%, #92400e 100%)",
        color: "#fef3c7",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px",
        fontSize: "13px",
        fontWeight: 500,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "16px" }}>🔌</span>
        <strong>Offline Mode</strong>
        &nbsp;— Supabase is not reachable. Your data is being saved locally in
        this browser. It will sync when the connection is restored.
      </span>

      <span style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={retryConnection}
          title="Re-check Supabase connection"
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: "6px",
            color: "#fef3c7",
            padding: "4px 12px",
            fontSize: "12px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ↻ Retry
        </button>

        <button
          onClick={exportLocalData}
          title="Download all local data as JSON backup"
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: "6px",
            color: "#fef3c7",
            padding: "4px 12px",
            fontSize: "12px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          ⬇ Backup Data
        </button>
      </span>
    </div>
  );
}
