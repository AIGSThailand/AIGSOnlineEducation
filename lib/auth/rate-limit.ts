import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const FIFTEEN_MIN = 15 * 60;
const ONE_HOUR = 60 * 60;

export type RateLimitResult = { ok: true } | { ok: false; error: string };

function clientIp(): string {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  return "unknown";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 320);
}

async function bump(
  bucket: string,
  windowSeconds: number,
  maxHits: number
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bump_auth_rate_limit" as never, {
    p_bucket: bucket,
    p_window_seconds: windowSeconds,
    p_max_hits: maxHits,
  } as never);

  if (error) {
    // Fail open on RPC/migration issues so auth is not hard-blocked in misconfigured envs.
    console.error("[auth/rate-limit]", error.message);
    return true;
  }

  return data === true;
}

const TOO_MANY =
  "Too many attempts. Please wait a few minutes and try again.";

/** Login: 10 / 15min per IP, 5 / 15min per email. */
export async function assertLoginRateLimit(email: string): Promise<RateLimitResult> {
  const ip = clientIp();
  const mail = normalizeEmail(email);
  const ipOk = await bump(`login:ip:${ip}`, FIFTEEN_MIN, 10);
  if (!ipOk) return { ok: false, error: TOO_MANY };
  const emailOk = await bump(`login:email:${mail}`, FIFTEEN_MIN, 5);
  if (!emailOk) return { ok: false, error: TOO_MANY };
  return { ok: true };
}

/** Register: 5 / hour per IP. */
export async function assertRegisterRateLimit(): Promise<RateLimitResult> {
  const ip = clientIp();
  const ok = await bump(`register:ip:${ip}`, ONE_HOUR, 5);
  if (!ok) return { ok: false, error: TOO_MANY };
  return { ok: true };
}

/** Forgot password: 10 / hour per IP, 3 / hour per email. */
export async function assertForgotPasswordRateLimit(
  email: string
): Promise<RateLimitResult> {
  const ip = clientIp();
  const mail = normalizeEmail(email);
  const ipOk = await bump(`forgot:ip:${ip}`, ONE_HOUR, 10);
  if (!ipOk) return { ok: false, error: TOO_MANY };
  const emailOk = await bump(`forgot:email:${mail}`, ONE_HOUR, 3);
  if (!emailOk) return { ok: false, error: TOO_MANY };
  return { ok: true };
}
