# Vercel staging setup

Step-by-step guide to deploy the **staging** environment on Vercel with a dedicated domain, Supabase staging project, and Stripe test mode.

Related: [environments.md](./environments.md) · [deployment.md](./deployment.md) · [github-actions.md](./github-actions.md)

---

## Architecture (staging)

```text
Git branch: develop
      ↓
Vercel (Production deployment for develop branch OR Preview — see below)
      ↓
https://staging.your-domain.com   (custom domain)
      ↓
Supabase STAGING project          (separate from production)
      ↓
Stripe TEST mode                  (pk_test_ / sk_test_)
```

---

## Prerequisites

- [ ] GitHub repo pushed (this project)
- [ ] **Separate** Supabase staging project created at [supabase.com/dashboard](https://supabase.com/dashboard)
- [ ] Stripe account in **test mode**
- [ ] Domain DNS access (for custom staging subdomain, optional but recommended)
- [ ] `develop` branch exists on GitHub

---

## Part 1 — Import project to Vercel

### 1. Create Vercel project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository **AIGSOnlineEducation**
3. Framework preset: **Next.js** (auto-detected)
4. Root directory: `.` (repo root)
5. Build command: `npm run build` (default)
6. Install command: `npm ci` (default)

Do **not** deploy yet — configure env vars first.

---

## Part 2 — Branch and deployment strategy

Two common patterns:

### Option A — Dedicated staging branch (recommended)

Map the **`develop`** branch to a stable staging URL.

1. Vercel → Project → **Settings** → **Git**
2. **Production Branch:** set to `develop` for a _staging-only_ Vercel project, **OR** keep `main` as production and use Option B for staging

**Recommended:** use **two Vercel projects** from the same repo:

| Vercel project        | Git branch | Purpose    |
| --------------------- | ---------- | ---------- |
| `aigs-lms-staging`    | `develop`  | Staging    |
| `aigs-lms-production` | `main`     | Production |

This avoids mixing Preview and Production scopes.

### Option B — Single Vercel project

| Vercel scope   | Branch / trigger              | `APP_ENV`    |
| -------------- | ----------------------------- | ------------ |
| **Preview**    | PRs + non-production branches | `staging`    |
| **Production** | `main`                        | `production` |

Use a **custom Preview domain** or assign `develop` deploys to a fixed alias.

---

## Part 3 — Staging environment variables

Vercel → Project → **Settings** → **Environment Variables**

Add each variable for the **Preview** and/or **Production** scope as appropriate (staging project = Preview scope if using Option B, or Production scope on the staging Vercel project if using Option A).

Replace placeholders with your real staging values.

### Required variables

| Variable                             | Example / notes                                      | Environments                               |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------------------ |
| `APP_ENV`                            | `staging`                                            | Preview (or Production on staging project) |
| `NEXT_PUBLIC_APP_URL`                | `https://staging.your-domain.com`                    | Same                                       |
| `NEXT_PUBLIC_SUPABASE_URL`           | `https://<staging-ref>.supabase.co`                  | Same                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | From Supabase → Settings → API (anon or publishable) | Same                                       |
| `SUPABASE_SERVICE_ROLE_KEY`          | Server only — service_role or secret key             | Same                                       |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...`                                        | Same                                       |
| `STRIPE_SECRET_KEY`                  | `sk_test_...`                                        | Same                                       |
| `STRIPE_WEBHOOK_SECRET`              | From Stripe staging webhook (step 5)                 | Same                                       |

### Example (copy structure, not values)

```ini
APP_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.your-domain.com

NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...or_sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...or_sb_secret_...

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Rules:**

- Never use `sk_live_*` on staging
- Never use production Supabase keys on staging
- `NEXT_PUBLIC_APP_URL` must match the URL users open in the browser

### Where to get Supabase staging keys

1. Open your **staging** project in Supabase Dashboard
2. **Settings** → **API**
3. Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
4. Copy **anon** / **publishable** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Copy **service_role** / **secret** key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Part 4 — Custom staging domain

Example: `staging.your-domain.com`

1. Vercel → Project → **Settings** → **Domains**
2. Add `staging.your-domain.com`
3. Vercel shows DNS records (usually `CNAME` → `cname.vercel-dns.com`)
4. Add the record at your DNS provider
5. Wait for SSL provisioning (usually minutes)

Update `NEXT_PUBLIC_APP_URL` to `https://staging.your-domain.com` and **redeploy**.

Optional: assign the domain to the `develop` branch deployment under **Domains** → branch assignment.

---

## Part 5 — Supabase Auth URLs (staging)

In the **staging** Supabase project → **Authentication** → **URL configuration**:

| Setting           | Value                                               |
| ----------------- | --------------------------------------------------- |
| **Site URL**      | `https://staging.your-domain.com`                   |
| **Redirect URLs** | `https://staging.your-domain.com/api/auth/callback` |
|                   | `https://staging.your-domain.com/reset-password`    |

If using Vercel Preview URLs without a custom domain, add each preview URL pattern you need, e.g.:

```text
https://*.vercel.app/api/auth/callback
```

(Custom domain is simpler for auth and Stripe.)

---

## Part 6 — Stripe webhook (staging)

1. [Stripe Dashboard](https://dashboard.stripe.com) → ensure **Test mode** is on
2. **Developers** → **Webhooks** → **Add endpoint**
3. URL: `https://staging.your-domain.com/api/stripe/webhook`
4. Events (minimum):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy **Signing secret** → Vercel `STRIPE_WEBHOOK_SECRET` (staging scope)
6. Redeploy

Use a **different** webhook secret than local (`stripe listen`) and production.

---

## Part 7 — Apply database schema to staging

Before the app works, staging Supabase needs migrations.

### Option A — GitHub Actions (after secrets configured)

Merge migration files to `develop` → workflow runs `supabase db push`.

See [github-actions.md](./github-actions.md).

### Option B — Manual (first time)

```bash
supabase link --project-ref <STAGING_PROJECT_REF>
supabase db push
```

Never run `supabase db reset` on hosted staging.

---

## Part 8 — Deploy and verify

1. Push to `develop` (or trigger redeploy in Vercel)
2. Open `https://staging.your-domain.com`
3. Register a test user
4. Promote to admin (Supabase SQL Editor on **staging**):

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1);
```

### Smoke checklist

- [ ] Login / register / password reset email (check Supabase Auth logs)
- [ ] Admin Course Builder — create course, module, lesson
- [ ] Course preview / published course page
- [ ] Stripe test checkout (card `4242 4242 4242 4242`)
- [ ] Webhook received (Stripe Dashboard → Webhooks → event log)

---

## Part 9 — Production Vercel (brief)

Use a **separate Vercel project** or Production scope on `main`:

| Variable              | Production value                       |
| --------------------- | -------------------------------------- |
| `APP_ENV`             | `production`                           |
| `NEXT_PUBLIC_APP_URL` | `https://your-production-domain.com`   |
| Supabase              | **Production** project URL and keys    |
| Stripe                | `pk_live_` / `sk_live_`                |
| Webhook               | Production endpoint + its own `whsec_` |

Run production migrations only via the manual GitHub Action after staging QA.

---

## Quick reference — your project

Fill this in for your team (do not commit real secrets):

| Item                 | Staging value                                        |
| -------------------- | ---------------------------------------------------- |
| Vercel project name  |                                                      |
| Staging URL          | `https://staging._______________`                    |
| Git branch           | `develop`                                            |
| Supabase project ref |                                                      |
| Stripe webhook URL   | `https://staging._______________/api/stripe/webhook` |

---

## Troubleshooting

| Symptom                         | Fix                                                                         |
| ------------------------------- | --------------------------------------------------------------------------- |
| Auth redirect goes to localhost | Set `NEXT_PUBLIC_APP_URL` on Vercel and redeploy                            |
| "Invalid JWT" / auth errors     | Confirm Supabase URL/key match the **staging** project                      |
| Stripe checkout fails           | Check `STRIPE_SECRET_KEY` is `sk_test_*` and keys match same Stripe account |
| Webhook 400                     | Update `STRIPE_WEBHOOK_SECRET` from the staging endpoint; redeploy          |
| Empty courses / RLS errors      | Run `supabase db push` on staging; check migrations applied                 |
| Live key error on deploy        | Set `APP_ENV=staging`; remove any `sk_live_*` from Preview/staging vars     |
