# Deployment

Git branch promotion, Vercel environments, Supabase targets, and Stripe modes for the AIGS Online Education Platform.

Related: [environments.md](./environments.md) · [database-migrations.md](./database-migrations.md)

---

## Recommended Git workflow

```text
feature/*
      ↓
Pull Request
      ↓
develop
      ↓
Staging deployment + QA
      ↓
main
      ↓
Production deployment
```

### Branch → environment mapping

| Branch      | Deployment             | Supabase               | Stripe |
| ----------- | ---------------------- | ---------------------- | ------ |
| `feature/*` | Local / Vercel Preview | Local or staging       | Test   |
| `develop`   | Staging site           | **Staging project**    | Test   |
| `main`      | Production site        | **Production project** | Live   |

Do not embed environment secrets in source code. Use Vercel environment variable scopes.

---

## Vercel configuration

### Environment scopes

| Vercel scope    | APP_ENV                 | Supabase           | Stripe |
| --------------- | ----------------------- | ------------------ | ------ |
| **Development** | `local` (local machine) | Supabase local     | Test   |
| **Preview**     | `staging`               | Staging project    | Test   |
| **Production**  | `production`            | Production project | Live   |

Set variables in Vercel → Project → Settings → Environment Variables. Mirror names from `.env.example`.

**Do not** put secrets in `vercel.json`.

### Preview deployments

Vercel Preview builds set `VERCEL_ENV=preview`. When `APP_ENV` is unset, the app resolves to **staging** behavior for guards (Stripe test keys required).

For preview URLs, configure Supabase Auth redirect URLs to include the preview domain pattern if using password reset flows.

---

## Pre-deploy checklist

### Staging

- [ ] Migrations applied (`supabase db push` to staging project)
- [ ] RLS smoke-tested (student / instructor / admin)
- [ ] Course Builder create/edit/publish tested
- [ ] Stripe test checkout + webhook tested
- [ ] Auth callback and password reset URLs configured in Supabase staging

### Production

- [ ] Same migrations already validated on staging
- [ ] `APP_ENV=production` set on Vercel Production
- [ ] Stripe live keys and production webhook secret configured
- [ ] Supabase production Auth URLs updated
- [ ] No test Stripe customers treated as production records

---

## Stripe webhooks by environment

| Environment | Endpoint                                         | Secret source                          |
| ----------- | ------------------------------------------------ | -------------------------------------- |
| Local       | `http://localhost:3000/api/stripe/webhook`       | `stripe listen` output                 |
| Staging     | `https://<staging-domain>/api/stripe/webhook`    | Stripe Dashboard → staging endpoint    |
| Production  | `https://<production-domain>/api/stripe/webhook` | Stripe Dashboard → production endpoint |

Each endpoint must have its **own** `STRIPE_WEBHOOK_SECRET`. Never reuse secrets across environments.

---

## Supabase Auth URLs

Configure per Supabase project (Dashboard → Authentication → URL configuration):

| Setting       | Local                                     | Staging              | Production              |
| ------------- | ----------------------------------------- | -------------------- | ----------------------- |
| Site URL      | `http://localhost:3000`                   | Staging URL          | Production URL          |
| Redirect URLs | `http://localhost:3000/api/auth/callback` | Staging callback URL | Production callback URL |

The application uses `NEXT_PUBLIC_APP_URL` for email redirect origins in auth actions — keep it aligned with the deployed domain.

---

## CI/CD

GitHub Actions workflows are in `.github/workflows/`:

| Workflow                             | Trigger                        | Purpose                         |
| ------------------------------------ | ------------------------------ | ------------------------------- |
| `ci.yml`                             | PR / push to `develop`, `main` | Lint + build                    |
| `supabase-migrations-staging.yml`    | Push to `develop` (migrations) | `supabase db push` → staging    |
| `supabase-migrations-production.yml` | Manual only                    | `supabase db push` → production |

Setup: [github-actions.md](./github-actions.md)

Vercel staging domain and env vars: [vercel-staging-setup.md](./vercel-staging-setup.md)

```text
develop merge → CI → migrations to staging (auto) → Vercel staging deploy
main merge    → manual production migration → Vercel production deploy
```

Production migrations require manual workflow dispatch and typed confirmation (`production`). Protect the GitHub `production` environment with required reviewers.

---

## What not to do

- Deploy production app pointing at staging Supabase
- Share one Supabase project between staging and production
- Use Stripe live keys on preview/staging
- Run LearnDash bulk import first on production
- Rotate production credentials without team coordination unless requested
