import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase browser client for use in Client Components.
 * Reads NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY).
 */
export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
