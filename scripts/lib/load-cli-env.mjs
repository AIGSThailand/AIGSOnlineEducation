/**
 * Shared CLI env-file loader for local / staging / production targets.
 *
 * Files (gitignored — never commit secrets):
 *   .env.local            — default; Next.js `npm run dev`
 *   .env.cli.staging      — CLI scripts against staging Supabase
 *   .env.cli.production   — CLI scripts against production (explicit only)
 *
 * Do NOT name the production CLI file `.env.production` — Next.js loads that
 * automatically during `next build` and can mix production secrets into builds.
 *
 * Usage:
 *   import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";
 *   const envName = parseEnvFlag(process.argv);
 *   loadCliEnv(envName);
 */

import fs from "fs";
import path from "path";

export const CLI_ENV_NAMES = ["local", "staging", "production"];

/** Preferred filenames (Next.js-safe). */
export const CLI_ENV_FILES = {
  local: ".env.local",
  staging: ".env.cli.staging",
  production: ".env.cli.production",
};

/** Legacy names still accepted with a warning. */
const LEGACY_CLI_ENV_FILES = {
  staging: ".env.staging",
  production: ".env.production",
};

/**
 * @param {string[]} argv process.argv (or slice)
 * @returns {"local"|"staging"|"production"}
 */
export function parseEnvFlag(argv = process.argv) {
  const args = argv.filter((a) => a !== "--");
  const eq = args.find((a) => a.startsWith("--env="));
  if (eq) {
    const value = eq.slice("--env=".length).trim().toLowerCase();
    return assertEnvName(value);
  }
  const idx = args.indexOf("--env");
  if (idx >= 0) {
    const value = (args[idx + 1] || "").trim().toLowerCase();
    return assertEnvName(value);
  }
  return "local";
}

/**
 * Remove --env / --env=… from argv so other parsers don't treat the name as an id.
 * @param {string[]} argv
 * @returns {string[]}
 */
export function stripEnvArgs(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--env") {
      i += 1; // skip value
      continue;
    }
    if (a.startsWith("--env=")) continue;
    out.push(a);
  }
  return out;
}

/**
 * @param {string} name
 * @returns {"local"|"staging"|"production"}
 */
export function assertEnvName(name) {
  if (!CLI_ENV_NAMES.includes(name)) {
    throw new Error(
      `Invalid --env "${name}". Use one of: ${CLI_ENV_NAMES.join(", ")}`
    );
  }
  return /** @type {"local"|"staging"|"production"} */ (name);
}

/**
 * @param {"local"|"staging"|"production"} name
 * @param {string} cwd
 * @returns {{ fileName: string, filePath: string, legacy: boolean }}
 */
function resolveEnvFile(name, cwd) {
  const preferred = CLI_ENV_FILES[name];
  const preferredPath = path.resolve(cwd, preferred);
  if (fs.existsSync(preferredPath)) {
    return { fileName: preferred, filePath: preferredPath, legacy: false };
  }

  const legacyName = LEGACY_CLI_ENV_FILES[name];
  if (legacyName) {
    const legacyPath = path.resolve(cwd, legacyName);
    if (fs.existsSync(legacyPath)) {
      return { fileName: legacyName, filePath: legacyPath, legacy: true };
    }
  }

  return { fileName: preferred, filePath: preferredPath, legacy: false };
}

/**
 * Load key=value pairs from the env file for `envName` into process.env.
 * @param {"local"|"staging"|"production"} envName
 * @param {{ cwd?: string, override?: boolean }} [options]
 * @returns {{ envName: string, filePath: string, loadedKeys: number }}
 */
export function loadCliEnv(envName = "local", options = {}) {
  const name = assertEnvName(envName);
  const cwd = options.cwd || process.cwd();
  const override = options.override !== false;
  const resolved = resolveEnvFile(name, cwd);

  if (!fs.existsSync(resolved.filePath)) {
    throw new Error(
      `Missing ${resolved.fileName} for --env ${name}.\n` +
        `  Copy:  cp .env.example ${CLI_ENV_FILES[name]}\n` +
        `  Then set APP_ENV=${name} and that environment's Supabase / Stripe keys.\n` +
        `  Never commit ${CLI_ENV_FILES[name]}.`
    );
  }

  if (resolved.legacy) {
    console.warn(
      `[env] Loaded legacy ${resolved.fileName}. Prefer ${CLI_ENV_FILES[name]} ` +
        `(Next.js auto-loads .env.production during \`next build\`).`
    );
  }

  let loadedKeys = 0;
  for (const line of fs.readFileSync(resolved.filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    const key = trimmed.slice(0, i).trim();
    const value = trimmed
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!key) continue;
    if (override || !(key in process.env)) {
      process.env[key] = value;
      loadedKeys += 1;
    }
  }

  if (!process.env.APP_ENV || override) {
    process.env.APP_ENV = name;
  }

  return { envName: name, filePath: resolved.filePath, loadedKeys };
}
