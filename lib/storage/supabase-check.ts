/**
 * Supabase Connection Check
 * ============================================================================
 * Pings the Supabase health endpoint to determine if the database is reachable.
 * Used by the hybrid storage layer to decide whether to use Supabase or
 * fall back to localStorage.
 *
 * Results are cached for 30 seconds to avoid hammering the network.
 */

let lastResult: boolean | null = null;
let lastChecked = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Returns true if Supabase is configured and reachable.
 * Safe to call from any client component.
 */
export async function isSupabaseOnline(): Promise<boolean> {
  // Server-side (SSR/Server Actions): always return false — localStorage
  // is not available on the server anyway, so callers handle this gracefully.
  if (typeof window === "undefined") return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars are not set, Supabase is definitely not configured
  if (
    !url ||
    !key ||
    url.includes("placeholder") ||
    url.includes("your-project")
  ) {
    return false;
  }

  // Return cached result if fresh
  const now = Date.now();
  if (lastResult !== null && now - lastChecked < CACHE_TTL_MS) {
    return lastResult;
  }

  try {
    // Use the Supabase REST health endpoint (no auth required)
    const res = await fetch(`${url}/rest/v1/`, {
      method: "HEAD",
      headers: { apikey: key },
      signal: AbortSignal.timeout(4000), // 4-second timeout
    });
    lastResult = res.ok || res.status === 200 || res.status === 401; // 401 means the server responded
    lastChecked = now;
  } catch {
    lastResult = false;
    lastChecked = now;
  }

  return lastResult;
}

/** Synchronous version using cached state — useful for render-time decisions */
export function isSupabaseOnlineCached(): boolean {
  return lastResult ?? false;
}

/** Force-invalidate the cache (call when network status changes) */
export function invalidateConnectionCache(): void {
  lastResult = null;
  lastChecked = 0;
}
