import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getClientEnv } from "@/lib/env/client";
import { getSupabaseServiceRoleKey } from "@/lib/env/server";
import type { Database } from "@/types/database.types";

/**
 * Creates an administrative Supabase client using the Service Role Key.
 * CRITICAL: NEVER import this into client components or expose it to the browser.
 * Used exclusively for server-side tasks such as Stripe webhooks and trusted jobs.
 */
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getClientEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createSupabaseClient<Database>(NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
