# CLI command reference

Quick copy-paste commands for **Next.js**, **Supabase**, **Vercel**, **Stripe**, **Git**, and project scripts.

Run all commands from the **repository root** unless noted.

Related docs: [environments.md](./environments.md) · [deployment.md](./deployment.md) · [database-migrations.md](./database-migrations.md) · [github-actions.md](./github-actions.md) · [vercel-staging-setup.md](./vercel-staging-setup.md) · [media-s3.md](./media-s3.md)

---

## Prerequisites (one-time)

### Install dependencies

```bash
npm install
```

### Copy environment template

```bash
# macOS / Linux / Git Bash
cp .env.example .env.local
cp .env.example .env.cli.staging      # optional — CLI --env staging
cp .env.example .env.cli.production   # optional — CLI --env production

# Windows PowerShell
Copy-Item .env.example .env.local
Copy-Item .env.example .env.cli.staging
Copy-Item .env.example .env.cli.production
```

Edit each file with that environment’s keys (`APP_ENV` + Supabase / Stripe).  
`npm run dev` uses `.env.local` only. Scripts accept `--env local|staging|production` (default `local`).  
Do **not** use `.env.production` for CLI secrets (Next.js loads it on `next build`). Never commit these files.

### Install CLIs (optional but recommended)

| Tool             | Install                                                              | Verify               |
| ---------------- | -------------------------------------------------------------------- | -------------------- |
| **Supabase CLI** | [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli) | `supabase --version` |
| **Stripe CLI**   | [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)     | `stripe --version`   |
| **Vercel CLI**   | `npm i -g vercel`                                                    | `vercel --version`   |
| **GitHub CLI**   | [cli.github.com](https://cli.github.com)                             | `gh --version`       |

---

## Next.js (npm scripts)

| Command          | Purpose                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `npm run dev`    | Start dev server → [http://localhost:3000](http://localhost:3000) |
| `npm run build`  | Production build (TypeScript + lint)                              |
| `npm run start`  | Run production build locally                                      |
| `npm run lint`   | ESLint                                                            |
| `npm run format` | Prettier format `**/*.{ts,tsx,md,json}`                           |

### Typical local dev session

```bash
npm run supabase:start
npm run supabase:status          # copy keys into .env.local
npm run dev
```

---

## Supabase — local

| npm script                | Equivalent          | Purpose                        |
| ------------------------- | ------------------- | ------------------------------ |
| `npm run supabase:start`  | `supabase start`    | Start local Docker stack       |
| `npm run supabase:stop`   | `supabase stop`     | Stop local stack               |
| `npm run supabase:status` | `supabase status`   | Show API URL, keys, Studio URL |
| `npm run supabase:reset`  | `supabase db reset` | Reapply all migrations + seed  |

### Useful Supabase CLI (local)

```bash
# Keys as env format (legacy JWT keys)
supabase status -o env

# Open local Studio in browser (or use URL from status)
# Default Studio: http://127.0.0.1:54323

# Create a new migration file
npm run db:migration:new -- my_change_name
# or
supabase migration new my_change_name

# List migration files / status locally
supabase migration list
```

### Local URLs (default)

| Service  | URL                                                       |
| -------- | --------------------------------------------------------- |
| API      | `http://127.0.0.1:54321`                                  |
| Database | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio   | `http://127.0.0.1:54323`                                  |

Set in `.env.local`:

```ini
APP_ENV=local
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
```

---

## Supabase — hosted (staging / production)

**Never run `supabase db reset` on hosted projects.**

### Link CLI to a project

```bash
# Staging (example ref for this repo — use your dashboard ref)
supabase link --project-ref bjtukjxodwthempjjude

# Production (replace with your production ref)
supabase link --project-ref <PRODUCTION_PROJECT_REF>
```

### Apply pending migrations

```bash
supabase db push
```

### Inspect remote migration state

```bash
supabase link --project-ref <PROJECT_REF>
supabase migration list
```

### Preferred workflow (CI)

| Target         | How migrations apply                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------ |
| **Staging**    | Push to `develop` (changes under `supabase/migrations/`) → GitHub Action runs `supabase db push` |
| **Production** | GitHub Actions → **Supabase migrations (production)** → manual run + type `production`           |

See [github-actions.md](./github-actions.md).

### Manual staging push (alternative)

```bash
supabase link --project-ref bjtukjxodwthempjjude
supabase db push
```

---

## Database migrations — workflow

```bash
# 1. Create migration
npm run db:migration:new -- add_my_feature

# 2. Edit supabase/migrations/<timestamp>_add_my_feature.sql

# 3. Test locally
npm run supabase:reset

# 4. Commit and push to develop
git add supabase/migrations/
git commit -m "feat: add my feature migration"
git push origin develop

# 5. Staging: auto via GitHub Action (or manual supabase db push)

# 6. Production: manual GitHub Action after staging validation
```

---

## Vercel

Most deploys are **automatic** when the GitHub repo is connected. Configure env vars in the Vercel dashboard — not in `vercel.json`.

### Project layout (this repo)

| Vercel project     | Branch    | Environment |
| ------------------ | --------- | ----------- |
| `aigs-lms-staging` | `develop` | Staging     |
| Production project | `main`    | Production  |

See [vercel-staging-setup.md](./vercel-staging-setup.md).

### Vercel CLI (optional)

```bash
# Log in
vercel login

# Link local folder to a Vercel project
vercel link

# Deploy preview from current branch
vercel

# Deploy to production (use with care)
vercel --prod

# Pull env vars from Vercel into .env.local (review before committing)
vercel env pull .env.local

# List deployments
vercel ls

# Redeploy latest (dashboard is usually easier)
vercel redeploy
```

### After changing Vercel env vars

Redeploy the staging/production project — `NEXT_PUBLIC_*` values are baked in at **build time**.

Dashboard: Project → **Deployments** → ⋮ → **Redeploy**.

---

## Stripe

### Local webhook forwarding

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the printed `whsec_...` into `.env.local` → `STRIPE_WEBHOOK_SECRET`, then restart `npm run dev`.

### Stripe CLI helpers

```bash
stripe login
stripe trigger checkout.session.completed   # test webhook events locally
```

### Webhook URLs by environment

| Environment | Endpoint                                         |
| ----------- | ------------------------------------------------ |
| Local       | `http://localhost:3000/api/stripe/webhook`       |
| Staging     | `https://<staging-domain>/api/stripe/webhook`    |
| Production  | `https://<production-domain>/api/stripe/webhook` |

Use a **separate** `STRIPE_WEBHOOK_SECRET` per endpoint.

---

## Git & GitHub

### Branch workflow

```bash
git checkout develop
git pull origin develop

git checkout -b feature/my-feature
# ... work ...
git add .
git commit -m "feat: describe change"
git push -u origin feature/my-feature
```

### Create pull request (GitHub CLI)

```bash
gh pr create --base develop --title "feat: my feature" --body "## Summary
- ...

## Test plan
- [ ] ..."
```

### Push develop / main

```bash
git push origin develop    # triggers staging CI + migration workflow (if migrations changed)
git push origin main       # production app deploy (migrations: manual GitHub Action)
```

---

## Project scripts — LearnDash migration

Requires `SUPABASE_SERVICE_ROLE_KEY` (and `NEXT_PUBLIC_SUPABASE_URL`) in `.env.local` pointing at the **target** environment.

**Run against staging first. Never first-run bulk import on production.**

```bash
# Dry run (no writes)
npm run migrate:learndash -- --dry-run

# Full course / lesson / section import
npm run migrate:learndash

# Skip course_steps rebuild (advanced)
npm run migrate:learndash -- --skip-steps-rebuild

# Quiz questions import
npm run migrate:learndash:quizzes -- --dry-run
npm run migrate:learndash:quizzes

# Normalize WordPress HTML in lesson content
npm run migrate:normalize-content -- --dry-run
npm run migrate:normalize-content
```

Place LearnDash export data under `learndash_data/` before running. See [migration-mapping.md](./migration-mapping.md).

### REST v2 inspection + single-course migrate (Phases 1–3)

Requires `LEARNDASH_BASE_URL`, `LEARNDASH_USERNAME`, `LEARNDASH_APP_PASSWORD` (WordPress Application Password).  
`--write` also needs `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from the selected env file.  
Production writes require `--allow-production-write` (or `ALLOW_LEARNDASH_MIGRATE_PRODUCTION=true`).

```bash
# Offline checks
npm run test:learndash-parse
npm run test:learndash-transform
npm run test:learndash-questions

# Inspect (loads .env.local by default)
npm run inspect:learndash-course -- 26475

# Migrate against staging / production env files
npm run migrate:learndash-courses -- --env staging --dry-run --with-questions
npm run migrate:learndash-courses -- --env staging --write --with-questions
npm run migrate:learndash-courses -- --env production --write --with-questions --allow-production-write

# Propose / migrate all published courses (local)
npm run migrate:learndash-courses -- --dry-run
npm run migrate:learndash-courses -- --write --with-questions

# Resume after a course id, or limit set
npm run migrate:learndash-courses -- --write --with-questions --after 26475
npm run migrate:learndash-courses -- --dry-run --only 26475,30660
```

See [features/migration/learndash/README.md](../features/migration/learndash/README.md) and [environments.md](./environments.md).

---

## Project scripts — auth utility

Manually confirm emails (uses `SUPABASE_SERVICE_ROLE_KEY` from the selected env file):

```bash
# List recent auth users (local)
npm run auth:verify-email -- --list

# Confirm email + set role
npm run auth:verify-email -- --email test@example.com
npm run auth:verify-email -- --email test@example.com --role admin
npm run auth:verify-email -- --email test@example.com --role instructor

# Against staging
npm run auth:verify-email -- --env staging --email you@example.com --role admin

# By user UUID
npm run auth:verify-email -- --id <user-uuid>
```

---

## Environment variables cheat sheet

| Variable                   | Local                    | Staging                 | Production              |
| -------------------------- | ------------------------ | ----------------------- | ----------------------- |
| `APP_ENV`                  | `local`                  | `staging`               | `production`            |
| `NEXT_PUBLIC_APP_URL`      | `http://localhost:3000`  | Staging URL             | Production URL          |
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` | Staging project URL     | Production project URL  |
| Stripe keys                | `pk_test_` / `sk_test_`  | `pk_test_` / `sk_test_` | `pk_live_` / `sk_live_` |

Full list: `.env.example` and [environments.md](./environments.md).

---

## Quick daily commands

### Start from scratch (local)

```bash
npm install
Copy-Item .env.example .env.local    # PowerShell
npm run supabase:start
npm run supabase:status
npm run supabase:reset
npm run dev
```

### Before opening a PR

```bash
npm run lint
npm run build
```

### After adding a SQL migration

```bash
npm run supabase:reset
npm run build
git add supabase/migrations/
git commit -m "feat: migration description"
git push origin develop
```

### Staging signup / profile issues

```bash
supabase link --project-ref bjtukjxodwthempjjude
supabase migration list
supabase db push
```

See [staging-troubleshooting.md](./staging-troubleshooting.md).

---

## Do not run on production

| Command                                        | Reason                |
| ---------------------------------------------- | --------------------- |
| `supabase db reset`                            | Wipes all data        |
| `npm run migrate:learndash` (first time)       | Test on staging first |
| `sk_live_*` in local/staging `.env`            | Blocked by env guards |
| Manual SQL in Dashboard without migration file | Causes schema drift   |

---

## Related documentation

| Doc                                                        | Topic                               |
| ---------------------------------------------------------- | ----------------------------------- |
| [environments.md](./environments.md)                       | Local / staging / production matrix |
| [deployment.md](./deployment.md)                           | Branch → deploy mapping             |
| [database-migrations.md](./database-migrations.md)         | Migration rules & RLS checklist     |
| [github-actions.md](./github-actions.md)                   | CI & automated `db push`            |
| [vercel-staging-setup.md](./vercel-staging-setup.md)       | Staging Vercel project setup        |
| [staging-troubleshooting.md](./staging-troubleshooting.md) | Staging auth / profiles             |
| [migration-mapping.md](./migration-mapping.md)             | LearnDash field mapping             |
