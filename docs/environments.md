# Environments

The AIGS Online Education Platform uses three isolated runtime environments. **Never share Supabase projects or Stripe credentials between staging and production.**

```text
LOCAL       → Next.js localhost + Supabase local + Stripe test
STAGING     → Vercel preview/staging + Supabase staging project + Stripe test
PRODUCTION  → Vercel production + Supabase production project + Stripe live
```

Related docs: [deployment.md](./deployment.md) · [database-migrations.md](./database-migrations.md) · [../rules.md](../rules.md)

---

## Environment matrix

|                    | Local                          | Staging                 | Production                    |
| ------------------ | ------------------------------ | ----------------------- | ----------------------------- |
| **APP_ENV**        | `local`                        | `staging`               | `production`                  |
| **Next.js**        | `http://localhost:3000`        | Staging / preview URL   | Production domain             |
| **Supabase**       | `http://127.0.0.1:54321` (CLI) | Separate hosted project | Separate hosted project       |
| **Stripe**         | Test (`pk_test_`, `sk_test_`)  | Test                    | Live (`pk_live_`, `sk_live_`) |
| **Webhook secret** | From `stripe listen`           | Staging endpoint secret | Production endpoint secret    |

---

## Environment variables

All variables are documented in `.env.example`. Configure per environment in:

| File / place | Used by |
|--------------|---------|
| `.env.local` | `npm run dev` (Next.js) + CLI default (`--env local`) |
| `.env.cli.staging` | CLI scripts only (`--env staging`) |
| `.env.cli.production` | CLI scripts only (`--env production`) |
| Vercel project env | Deployed staging / production apps |

**Create CLI files (gitignored):**

```bash
cp .env.example .env.local
cp .env.example .env.cli.staging
cp .env.example .env.cli.production
```

Do **not** name a secrets file `.env.production` — Next.js loads that during `next build`.

### Required public variables

| Variable                             | Description                                        |
| ------------------------------------ | -------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                | App origin for auth callbacks and Stripe redirects |
| `NEXT_PUBLIC_SUPABASE_URL`           | Supabase API URL                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Supabase anon (publishable) key                    |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key                             |

### Required server-only variables

| Variable                    | Description                                              |
| --------------------------- | -------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin Supabase access — webhooks, migration scripts only |
| `STRIPE_SECRET_KEY`         | Stripe secret API key                                    |
| `STRIPE_WEBHOOK_SECRET`     | Webhook signing secret for `/api/stripe/webhook`         |

### Runtime label

| Variable  | Values                           | Notes                                                |
| --------- | -------------------------------- | ---------------------------------------------------- |
| `APP_ENV` | `local`, `staging`, `production` | Explicit label; falls back to `VERCEL_ENV` on Vercel |

**Never** prefix secrets with `NEXT_PUBLIC_`.

---

## Typed validation (`lib/env/`)

| Module              | Purpose                                                               |
| ------------------- | --------------------------------------------------------------------- |
| `lib/env/client.ts` | Validates public env vars (Supabase URL/key, app URL)                 |
| `lib/env/server.ts` | Validates secrets; Stripe/Supabase environment guards                 |
| `lib/env/guards.ts` | Blocks `sk_live_*` in local/staging; warns on local + hosted Supabase |

Guards:

- **Supabase** — when the service-role / admin client is used (LearnDash migrate, etc.)
- **Stripe** — only when Stripe secrets are accessed (checkout, webhooks), not on content migrate

Optional overrides (use sparingly):

- `ALLOW_HOSTED_SUPABASE_LOCAL=true` — suppress warning when local dev uses a hosted Supabase URL
- `ALLOW_STRIPE_TEST_IN_PRODUCTION=true` — allow `sk_test_*` when `APP_ENV=production` (Stripe ops only)

---

## Local development

### 1. Start Supabase local

```bash
npm run supabase:start
npm run supabase:status   # copy API URL and keys into .env.local
```

Default API URL: `http://127.0.0.1:54321`

**Supabase CLI 2.45+** shows **Publishable** (`sb_publishable_...`) and **Secret** (`sb_secret_...`) keys instead of legacy JWT anon/service_role keys. Use them as drop-in values for `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Legacy JWT keys are still available via `supabase status -o env` if needed.

### 2. Reset database (migrations + seed)

```bash
npm run supabase:reset
```

Rebuilds schema from `supabase/migrations/` and runs `supabase/seed.sql`.

### 3. Configure `.env.local`

```bash
cp .env.example .env.local
```

Set keys from `supabase status` output. Keep `APP_ENV=local`.

### 4. Stripe test webhooks

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

### 5. Run Next.js

```bash
npm run dev
```

---

## Staging

Use a **dedicated Supabase project** (not production).

```env
APP_ENV=staging
NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=<staging-webhook-secret>
NEXT_PUBLIC_APP_URL=https://staging.your-domain.com
```

Staging must **never** contain `sk_live_*` or production Supabase service-role keys.

### Supabase Auth URLs (staging)

In Supabase Dashboard → Authentication → URL configuration:

- **Site URL:** staging app URL
- **Redirect URLs:** `https://staging.your-domain.com/api/auth/callback`

### Stripe webhook (staging)

`https://staging.your-domain.com/api/stripe/webhook` — use a **separate** signing secret from local/production.

---

## Production

Use a **separate Supabase project** and **Stripe live mode**.

```env
APP_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://<production-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-anon>
SUPABASE_SERVICE_ROLE_KEY=<production-service-role>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=<production-webhook-secret>
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

Do not store production values in Git.

### Supabase Auth URLs (production)

- **Site URL:** production app URL
- **Redirect URLs:** `https://your-production-domain.com/api/auth/callback`

### Stripe webhook (production)

`https://your-production-domain.com/api/stripe/webhook`

---

## LearnDash migration testing

Historical imports must follow:

```text
WordPress / LearnDash export
        ↓
Migration scripts (scripts/migrate-learndash*.mjs)
        ↓
Supabase STAGING
        ↓
Reconciliation (counts, spot checks)
        ↓
Fix / repeat
        ↓
Production migration (explicit approval only)
```

**Do not** run the first full historical import against production.

See [migration-mapping.md](./migration-mapping.md) and [database-migrations.md](./database-migrations.md).

---

## AI agent safety

Agents working on this repo must:

1. Default to **local** environment assumptions.
2. Never run production schema commands without explicit user instruction.
3. Never use production service-role keys or Stripe live keys locally.
4. Create SQL **migrations** instead of editing hosted schemas manually.
5. Report staging and production promotion steps separately.
6. Warn before destructive operations affecting users, progress, enrollments, or billing.

---

## Verification checklist

- [ ] Local uses Supabase local (`127.0.0.1:54321`) or acknowledged hosted override
- [ ] Staging Supabase project ≠ production Supabase project
- [ ] Staging uses Stripe test mode only
- [ ] Production uses Stripe live mode only
- [ ] Each Stripe webhook endpoint has its own `STRIPE_WEBHOOK_SECRET`
- [ ] No secrets committed to Git
- [ ] `supabase db reset` never run against production
