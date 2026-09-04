import { getLearnDashConfig, type LearnDashConfig } from "./config";
import { LearnDashError } from "./errors";

export type LearnDashRequestOptions = {
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  method?: "GET";
  /** Override config for tests. */
  config?: LearnDashConfig;
};

function buildUrl(baseUrl: string, path: string, query?: LearnDashRequestOptions["query"]): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalized, `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function basicAuthHeader(username: string, appPassword: string): string {
  const token = Buffer.from(`${username}:${appPassword}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Low-level LearnDash REST GET. Read-only — never call mutating methods.
 */
export async function learndashFetch<T>(options: LearnDashRequestOptions): Promise<{
  data: T;
  headers: Headers;
  status: number;
}> {
  const config = options.config ?? getLearnDashConfig();
  const method = options.method ?? "GET";
  if (method !== "GET") {
    throw new LearnDashError(
      "LEARNDASH_INVALID_RESPONSE",
      "LearnDash adapter is read-only; only GET is allowed."
    );
  }

  const url = buildUrl(config.baseUrl, options.path, options.query);
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= config.maxRetries) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: basicAuthHeader(config.username, config.appPassword),
        },
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        const bodyText = await response.text().catch(() => "");
        let wpMessage = "";
        try {
          const parsed = JSON.parse(bodyText) as { code?: string; message?: string };
          wpMessage = [parsed.code, parsed.message].filter(Boolean).join(" — ");
        } catch {
          wpMessage = bodyText.replace(/\s+/g, " ").slice(0, 240);
        }
        throw new LearnDashError(
          "LEARNDASH_AUTH_FAILED",
          `LearnDash authentication failed (HTTP ${response.status})${wpMessage ? `: ${wpMessage}` : ""}. Use the WP login username and a WordPress Application Password (24 characters), not the site login password.`,
          { status: response.status, details: wpMessage }
        );
      }

      if (response.status === 404) {
        throw new LearnDashError("LEARNDASH_NOT_FOUND", `LearnDash resource not found: ${options.path}`, {
          status: 404,
        });
      }

      if (response.status === 429 || response.status >= 500) {
        if (attempt <= config.maxRetries) {
          const retryAfter = Number(response.headers.get("retry-after") || 0);
          await sleep(retryAfter > 0 ? retryAfter * 1000 : 400 * attempt);
          continue;
        }
        throw new LearnDashError(
          response.status === 429 ? "LEARNDASH_RATE_LIMITED" : "LEARNDASH_NETWORK",
          `LearnDash request failed with status ${response.status}`,
          { status: response.status }
        );
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        throw new LearnDashError(
          "LEARNDASH_INVALID_RESPONSE",
          `LearnDash request failed (${response.status}) for ${options.path}`,
          { status: response.status, details: bodyText.slice(0, 500) }
        );
      }

      const data = (await response.json()) as T;
      return { data, headers: response.headers, status: response.status };
    } catch (err) {
      lastError = err;
      if (err instanceof LearnDashError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        if (attempt <= config.maxRetries) {
          await sleep(300 * attempt);
          continue;
        }
        throw new LearnDashError("LEARNDASH_TIMEOUT", `LearnDash request timed out: ${options.path}`);
      }
      if (attempt <= config.maxRetries) {
        await sleep(300 * attempt);
        continue;
      }
      throw new LearnDashError(
        "LEARNDASH_NETWORK",
        err instanceof Error ? err.message : "LearnDash network error"
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new LearnDashError("LEARNDASH_NETWORK", "LearnDash request failed");
}

/**
 * Fetch all pages of a WP REST collection.
 * Uses `X-WP-TotalPages` when present; otherwise stops when a page returns fewer than per_page.
 */
export async function fetchAllPages<T>(input: {
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  perPage?: number;
  config?: LearnDashConfig;
}): Promise<T[]> {
  const config = input.config ?? getLearnDashConfig();
  const perPage = input.perPage ?? config.perPage;
  const results: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const { data, headers } = await learndashFetch<T[]>({
      path: input.path,
      query: { ...input.query, page, per_page: perPage },
      config,
    });

    if (!Array.isArray(data)) {
      throw new LearnDashError(
        "LEARNDASH_INVALID_RESPONSE",
        `Expected array from ${input.path}, got ${typeof data}`
      );
    }

    results.push(...data);

    const headerPages = Number(headers.get("x-wp-totalpages") || 0);
    if (headerPages > 0) {
      totalPages = headerPages;
    } else if (data.length < perPage) {
      break;
    } else {
      totalPages = page + 1;
    }

    page += 1;

    // Safety ceiling
    if (page > 500) {
      throw new LearnDashError(
        "LEARNDASH_INVALID_RESPONSE",
        `Pagination exceeded safety limit for ${input.path}`
      );
    }
  }

  return results;
}

/** Run async work over items with a concurrency limit. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, () =>
    runWorker()
  );
  await Promise.all(workers);
  return results;
}
