/**
 * Manually confirm a user's email in Supabase Auth (staging / local admin utility).
 *
 * Use when email confirmation is enabled and you need to activate test accounts
 * without waiting for the confirmation email.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY for the target environment (.env.local).
 *
 * Usage:
 *   node scripts/verify-user-email.mjs --list
 *   node scripts/verify-user-email.mjs --email test@example.com
 *   node scripts/verify-user-email.mjs --email test@example.com --role admin
 *   node scripts/verify-user-email.mjs --id <user-uuid>
 *
 * npm run auth:verify-email -- --email test@example.com --role admin
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...rest] = trimmed.split("=");
        process.env[key.trim()] = rest.join("=").trim();
      }
    });
}

function parseArgs(argv) {
  const args = { email: null, id: null, role: null, list: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--list") args.list = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--email" && argv[i + 1]) args.email = argv[++i];
    else if (arg === "--id" && argv[i + 1]) args.id = argv[++i];
    else if (arg === "--role" && argv[i + 1]) args.role = argv[++i];
  }
  return args;
}

function printHelp() {
  console.log(`
Verify Supabase Auth email (admin utility)

  --list                 List recent users and verification status
  --email <address>      Confirm email for this user
  --id <uuid>            Confirm email by user id
  --role <admin|instructor|student>  Optional: update profiles.role after verify
  --help                 Show this help

Examples:
  npm run auth:verify-email -- --list
  npm run auth:verify-email -- --email you@example.com --role admin
`);
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const args = parseArgs(process.argv);

if (args.help) {
  printHelp();
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VALID_ROLES = new Set(["admin", "instructor", "student"]);

async function listUsers() {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (error) {
    console.error("Failed to list users:", error.message);
    process.exit(1);
  }

  const users = data.users ?? [];
  if (users.length === 0) {
    console.log("No users found.");
    return;
  }

  console.log(`\nUsers on ${supabaseUrl} (max 50):\n`);
  console.log("verified | role (profile) | email | id");
  console.log("-".repeat(80));

  for (const user of users) {
    const verified = user.email_confirmed_at ? "yes" : "no ";
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role ?? "-";
    console.log(`${verified}      | ${String(role).padEnd(10)} | ${user.email ?? "(no email)"} | ${user.id}`);
  }
  console.log("");
}

async function findUser() {
  if (args.id) {
    const { data, error } = await supabase.auth.admin.getUserById(args.id);
    if (error || !data.user) {
      console.error("User not found:", args.id);
      process.exit(1);
    }
    return data.user;
  }

  if (args.email) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      console.error("Failed to search users:", error.message);
      process.exit(1);
    }
    const user = data.users.find(
      (u) => u.email?.toLowerCase() === args.email.toLowerCase()
    );
    if (!user) {
      console.error(`No user with email: ${args.email}`);
      process.exit(1);
    }
    return user;
  }

  console.error("Provide --email or --id (or --list). Use --help for usage.");
  process.exit(1);
}

async function verifyUser() {
  const user = await findUser();

  if (user.email_confirmed_at) {
    console.log(`Already verified: ${user.email} (${user.id})`);
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });
    if (error) {
      console.error("Failed to verify email:", error.message);
      process.exit(1);
    }
    console.log(`Email verified: ${data.user.email} (${data.user.id})`);
  }

  if (args.role) {
    if (!VALID_ROLES.has(args.role)) {
      console.error(`Invalid role "${args.role}". Use: admin, instructor, student`);
      process.exit(1);
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: args.role })
      .eq("id", user.id);

    if (profileError) {
      console.error("Verified email but failed to update role:", profileError.message);
      process.exit(1);
    }
    console.log(`Profile role set to: ${args.role}`);
  }
}

async function main() {
  console.log(`Target: ${supabaseUrl}`);

  if (args.list) {
    await listUsers();
    return;
  }

  await verifyUser();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
