import { createServerClient } from "@supabase/ssr";
import { getClientEnv } from "@/lib/env/client";
import type { Database } from "@/types/database.types";

/** Isolated public reads: never inherit the editor's cookies/session. */
export function createAnonymousClient() {
  const env = getClientEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
