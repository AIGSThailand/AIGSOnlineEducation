/**
 * LearnDash REST error codes (Phase 1 inspection).
 * Do not expose stack traces or credentials in admin UI later.
 */
export type LearnDashErrorCode =
  | "LEARNDASH_NOT_CONFIGURED"
  | "LEARNDASH_AUTH_FAILED"
  | "LEARNDASH_NOT_FOUND"
  | "LEARNDASH_RATE_LIMITED"
  | "LEARNDASH_INVALID_RESPONSE"
  | "LEARNDASH_TIMEOUT"
  | "LEARNDASH_NETWORK"
  | "LEARNDASH_MISSING_STEP"
  | "UNSUPPORTED_STEP_TYPE";

export class LearnDashError extends Error {
  readonly code: LearnDashErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(code: LearnDashErrorCode, message: string, options?: { status?: number; details?: unknown }) {
    super(message);
    this.name = "LearnDashError";
    this.code = code;
    this.status = options?.status;
    this.details = options?.details;
  }
}
