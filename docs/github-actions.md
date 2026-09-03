# GitHub Actions

CI and Supabase migration deployment for the AIGS Online Education Platform.

Related: [deployment.md](./deployment.md) · [database-migrations.md](./database-migrations.md) · [vercel-staging-setup.md](./vercel-staging-setup.md)

---

## Workflows

| Workflow                  | File                                                   | Trigger                                       | Target                  |
| ------------------------- | ------------------------------------------------------ | --------------------------------------------- | ----------------------- |
| **CI**                    | `.github/workflows/ci.yml`                             | PR / push to `develop`, `main`                | Lint + build            |
| **Staging migrations**    | `.github/workflows/supabase-migrations-staging.yml`    | Push to `develop` (migration paths) or manual | Supabase **staging**    |
| **Production migrations** | `.github/workflows/supabase-migrations-production.yml` | Manual only (`workflow_dispatch`)             | Supabase **production** |

Vercel deploys the Next.js app automatically when you connect the repo. These workflows handle **database schema** separately.

```text
feature/* → PR → CI (lint/build)
develop   → push migrations → GitHub Action → supabase db push (staging)
          → Vercel deploys staging site (see vercel-staging-setup.md)
main      → manual production migration workflow → supabase db push (production)
          → Vercel deploys production site
```

---

## One-time setup

### 1. Create a Supabase access token

1. Open [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens)
2. Generate a token (e.g. `github-actions-aigs`)
3. Copy it — shown once

### 2. Collect project refs and DB passwords

For each **hosted** project (staging and production):

| Value           | Where to find it                                          |
| --------------- | --------------------------------------------------------- |
| **Project ref** | Dashboard URL: `https://supabase.com/project/<ref>`       |
| **DB password** | Project → **Settings** → **Database** → database password |

Use **separate** Supabase projects for staging and production.

### 3. Add GitHub repository secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret                            | Description                                             |
| --------------------------------- | ------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`           | Personal access token from step 1                       |
| `SUPABASE_STAGING_PROJECT_REF`    | Staging project ref                                     |
| `SUPABASE_STAGING_DB_PASSWORD`    | Staging database password                               |
| `SUPABASE_PRODUCTION_PROJECT_REF` | Production project ref (production workflow only)       |
| `SUPABASE_PRODUCTION_DB_PASSWORD` | Production database password (production workflow only) |

Never commit these values to Git.

### 4. Configure GitHub Environments (recommended)

Repo → **Settings** → **Environments**

#### `staging`

- No required reviewers (optional)
- Can restrict to `develop` branch deployments

#### `production`

- **Required reviewers** — at least one teammate must approve
- Optional: deployment branch rule — `main` only

The migration workflows reference `environment: staging` and `environment: production` so secrets can be scoped per environment later if you prefer Environment secrets over repository secrets.

### 5. Ensure `develop` branch exists

```bash
git checkout -b develop
git push -u origin develop
```

Migration auto-deploy runs on pushes to `develop` when files under `supabase/migrations/` change.

---

## Staging migration deploy (automatic)

When you merge a PR into `develop` that includes new files in `supabase/migrations/`:

1. **verify-local** — `supabase db start` applies all migrations on a fresh CI database
2. **deploy-staging** — `supabase link` + `supabase db push` to the staging project

### Manual run

Actions → **Supabase migrations (staging)** → **Run workflow** → branch `develop`

### Local equivalent

```bash
supabase link --project-ref <STAGING_REF>
supabase db push
```

---

## Production migration deploy (manual)

Production migrations **never** run automatically.

1. Validate the same migration on staging (app + RLS + Course Builder)
2. Merge `develop` → `main`
3. Actions → **Supabase migrations (production)** → **Run workflow**
4. Type `production` in the confirmation field
5. Approve if the `production` environment has required reviewers
6. Vercel production deploy (usually automatic on `main` push) should follow **after** schema is compatible

---

## CI (lint + build)

Runs on every PR to `develop` or `main`. Uses placeholder env vars — not connected to real Supabase or Stripe.

---

## Troubleshooting

| Error                                 | Likely cause                             | Fix                                                           |
| ------------------------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| `Invalid access token`                | Wrong or expired `SUPABASE_ACCESS_TOKEN` | Regenerate token, update secret                               |
| `password authentication failed`      | Wrong `SUPABASE_*_DB_PASSWORD`           | Reset DB password in Supabase Dashboard                       |
| `Remote migration versions not found` | Drift between local and remote           | Inspect `supabase migration list`; fix forward only           |
| `verify-local` fails                  | Broken SQL in migration                  | Fix migration, test with `npm run supabase:reset` locally     |
| Workflow skipped                      | No migration file changes on push        | Use **Run workflow** manually or touch `supabase/migrations/` |

---

## Security rules

- Do not store production secrets in repository variables visible to all branches without environment protection
- Do not add `supabase db reset` to any hosted-environment workflow
- Do not echo secrets in workflow logs
- Run LearnDash import scripts manually against staging first — not via these workflows
