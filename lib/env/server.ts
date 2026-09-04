import { z } from "zod";
import { getClientEnv } from "./client";
import { assertStripeEnvironment, assertSupabaseEnvironment } from "./guards";
import { resolveAppEnv } from "./resolve-app-env";
import type { AppEnv, ServerSecrets } from "./types";

const serverSecretsSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
});

let cachedSecrets: ServerSecrets | null = null;
let supabaseGuardsApplied = false;
let stripeGuardsApplied = false;

/** Supabase URL/env pairing — safe for admin/CLI jobs that do not touch Stripe. */
function applySupabaseGuards(): void {
  if (supabaseGuardsApplied) return;

  const appEnv = resolveAppEnv();
  const client = getClientEnv();
  assertSupabaseEnvironment(appEnv, client.NEXT_PUBLIC_SUPABASE_URL);

  supabaseGuardsApplied = true;
}

/** Stripe live/test vs APP_ENV — only when Stripe secrets are used. */
function applyStripeGuards(): void {
  if (stripeGuardsApplied) return;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    assertStripeEnvironment(resolveAppEnv(), stripeKey);
  }

  stripeGuardsApplied = true;
}

/**
 * Returns the validated application environment label.
 */
export function getAppEnv(): AppEnv {
  return resolveAppEnv();
}

/**
 * Server-only secrets. Validates on first access and applies environment guards.
 */
export function getServerSecrets(): ServerSecrets {
  applySupabaseGuards();
  applyStripeGuards();

  if (cachedSecrets) return cachedSecrets;

  const parsed = serverSecretsSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  });

  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    throw new Error(`Server environment validation failed: ${message}`);
  }

  assertStripeEnvironment(resolveAppEnv(), parsed.data.STRIPE_SECRET_KEY);

  cachedSecrets = parsed.data;
  return cachedSecrets;
}

/** Stripe secret only — for routes that do not need the full secret bundle. */
export function getStripeSecretKey(): string {
  applySupabaseGuards();
  applyStripeGuards();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is required for this operation.");
  }
  assertStripeEnvironment(resolveAppEnv(), key);
  return key;
}

/** Webhook secret only. */
export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required for webhook verification.");
  }
  return secret;
}

/**
 * Service role key only — admin client / trusted server jobs (LearnDash migrate, etc.).
 * Does not enforce Stripe live/test pairing so CLI content imports can run when
 * `.env.cli.production` still has placeholder sk_test_* keys.
 */
export function getSupabaseServiceRoleKey(): string {
  applySupabaseGuards();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for this operation.");
  }
  return key;
}
