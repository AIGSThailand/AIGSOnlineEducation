import type { AppEnv } from "./types";

/**
 * Resolves the runtime environment from explicit config or deployment hints.
 * Not used as a security boundary — guards also inspect credential patterns.
 */
export function resolveAppEnv(): AppEnv {
  const explicit = process.env.APP_ENV?.trim().toLowerCase();
  if (explicit === "local" || explicit === "staging" || explicit === "production") {
    return explicit;
  }

  if (process.env.VERCEL_ENV === "production") {
    return "production";
  }

  if (process.env.VERCEL_ENV === "preview") {
    return "staging";
  }

  return "local";
}

export function isProductionAppEnv(env: AppEnv = resolveAppEnv()): boolean {
  return env === "production";
}
