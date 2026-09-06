// =============================================================================
// Minimal Deno global type stubs for Supabase Edge Functions
// These are NOT compiled by the root tsconfig.json (supabase/functions is
// excluded). This file exists only so that editors opening individual
// Edge Function files in isolation get basic Deno type resolution.
// =============================================================================

declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }
  const env: Env;

  function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;

  const args: string[];
  const pid: number;
  const version: { deno: string; v8: string; typescript: string };
}

// Supabase Edge Runtime extras (cors helpers etc. come from esm.sh at runtime)
declare const EdgeRuntime: string | undefined;
