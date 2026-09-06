import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Creates an administrative Supabase client using the SERVICE_ROLE_KEY.
 * Does not depend on next/headers, making it safely runnable in all server & test environments.
 * WARNING: Server-only. Never expose this client to the browser.
 */
export function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes("your-project-id")) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
