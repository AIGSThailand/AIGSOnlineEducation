import { resolveAppEnv } from "@/lib/env/resolve-app-env";

export type MigrationWriteGuardOptions = {
  dryRun: boolean;
  /** Explicit CLI flag or ALLOW_LEARNDASH_MIGRATE_PRODUCTION=true */
  allowProductionWrite: boolean;
};

/**
 * Block accidental writes to production Supabase unless explicitly allowed.
 * Dry-run always passes.
 */
export function assertLearndashMigrationWriteAllowed(options: MigrationWriteGuardOptions): void {
  if (options.dryRun) return;

  const appEnv = resolveAppEnv();
  const envAllow = process.env.ALLOW_LEARNDASH_MIGRATE_PRODUCTION === "true";
  const allow = options.allowProductionWrite || envAllow;

  if (appEnv === "production" && !allow) {
    throw new Error(
      'Refusing LearnDash course migration writes while APP_ENV is "production". ' +
        "Re-run with --dry-run, or pass --allow-production-write " +
        "(or set ALLOW_LEARNDASH_MIGRATE_PRODUCTION=true) after confirming the target project."
    );
  }
}

export function describeMigrationTarget(): {
  appEnv: string;
  supabaseUrl: string;
} {
  return {
    appEnv: resolveAppEnv(),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "(missing)",
  };
}
