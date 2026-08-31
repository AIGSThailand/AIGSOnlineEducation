import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client for use in Client Components (browser context).
 * Uses public environment variables only.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
