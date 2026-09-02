import type { AppEnv } from "./types";

/** Prevent live Stripe keys in local/staging. Never logs secret values. */
export function assertStripeEnvironment(appEnv: AppEnv, stripeSecretKey: string): void {
  if (!stripeSecretKey) return;

  const isLiveSecret = stripeSecretKey.startsWith("sk_live_");
  const isTestSecret = stripeSecretKey.startsWith("sk_test_");

  if ((appEnv === "local" || appEnv === "staging") && isLiveSecret) {
    throw new Error(
      `Stripe configuration error: live secret key detected while APP_ENV is "${appEnv}". ` +
        "Use Stripe test mode (sk_test_*) for local and staging."
    );
  }

  if (appEnv === "production" && isTestSecret && process.env.ALLOW_STRIPE_TEST_IN_PRODUCTION !== "true") {
    throw new Error(
      'Stripe configuration error: test secret key detected while APP_ENV is "production". ' +
        "Set ALLOW_STRIPE_TEST_IN_PRODUCTION=true only for controlled operations."
    );
  }
}

/** Discourage connecting local APP_ENV to a hosted production Supabase project. */
export function assertSupabaseEnvironment(appEnv: AppEnv, supabaseUrl: string): void {
  if (!supabaseUrl) return;

  const isLocalSupabase =
    supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost");
  const isHostedSupabase = supabaseUrl.includes(".supabase.co");

  if (appEnv === "local" && isHostedSupabase && process.env.ALLOW_HOSTED_SUPABASE_LOCAL !== "true") {
    console.warn(
      "[env] APP_ENV=local but NEXT_PUBLIC_SUPABASE_URL points to hosted Supabase. " +
        "Prefer `supabase start` (http://127.0.0.1:54321) for local development. " +
        "Set ALLOW_HOSTED_SUPABASE_LOCAL=true to suppress this warning."
    );
  }

  if ((appEnv === "staging" || appEnv === "production") && isLocalSupabase) {
    throw new Error(
      `Supabase configuration error: local Supabase URL detected while APP_ENV is "${appEnv}". ` +
        "Use a dedicated hosted Supabase project for staging/production."
    );
  }
}
