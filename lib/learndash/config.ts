import { LearnDashError } from "./errors";

export type LearnDashConfig = {
  baseUrl: string;
  username: string;
  appPassword: string;
  /** Default page size for list endpoints. */
  perPage: number;
  /** Request timeout in ms. */
  timeoutMs: number;
  /** Max retries for 429 / 5xx. */
  maxRetries: number;
  /** Max concurrent detail fetches. */
  concurrency: number;
};

/**
 * Server-only LearnDash REST config from env.
 * Never import this module from Client Components.
 */
export function getLearnDashConfig(): LearnDashConfig {
  const baseUrl = (process.env.LEARNDASH_BASE_URL || "").trim().replace(/\/$/, "");
  const username = (process.env.LEARNDASH_USERNAME || "").trim();
  // WP Application Passwords are 24 chars; spaces are optional display separators.
  const appPassword = (process.env.LEARNDASH_APP_PASSWORD || "").trim().replace(/\s+/g, "");

  if (!baseUrl || !username || !appPassword) {
    throw new LearnDashError(
      "LEARNDASH_NOT_CONFIGURED",
      "LearnDash REST is not configured. Set LEARNDASH_BASE_URL, LEARNDASH_USERNAME, and LEARNDASH_APP_PASSWORD."
    );
  }

  return {
    baseUrl,
    username,
    appPassword,
    perPage: Number(process.env.LEARNDASH_PER_PAGE || 50),
    timeoutMs: Number(process.env.LEARNDASH_TIMEOUT_MS || 30000),
    maxRetries: Number(process.env.LEARNDASH_MAX_RETRIES || 3),
    concurrency: Number(process.env.LEARNDASH_CONCURRENCY || 5),
  };
}

export function isLearnDashConfigured(): boolean {
  return Boolean(
    process.env.LEARNDASH_BASE_URL?.trim() &&
      process.env.LEARNDASH_USERNAME?.trim() &&
      process.env.LEARNDASH_APP_PASSWORD?.trim()
  );
}
