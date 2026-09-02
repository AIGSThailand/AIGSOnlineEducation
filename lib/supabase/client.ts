import { createBrowserClient } from "@supabase/ssr";
import { getClientEnv } from "@/lib/env/client";
import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client for use in Client Components (browser context).
 * Uses public environment variables only.
 */
export function createClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getClientEnv();

  return createBrowserClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
