# Database migrations

All schema changes for the AIGS LMS must be version-controlled SQL migrations under `supabase/migrations/`.

**Hard rule:** Never edit an already-applied production migration. Fix forward with a new migration file.

Related: [environments.md](./environments.md) · [deployment.md](./deployment.md)

---

## Migration flow

```text
Create migration locally
        ↓
Test locally (supabase db reset)
        ↓
Commit to Git
        ↓
Apply to Supabase STAGING
        ↓
Validate staging (app + RLS + Course Builder)
        ↓
Apply the SAME migration to Supabase PRODUCTION
        ↓
Deploy production app (Vercel)
```

Never maintain divergent staging and production schemas by hand-editing the SQL editor.

---

## Local commands

### Start / stop Supabase local

```bash
npm run supabase:start
npm run supabase:status
npm run supabase:stop
```

### Reset local database (migrations + seed)

```bash
npm run supabase:reset
```

Equivalent to:

```bash
supabase db reset
```

This applies all files in `supabase/migrations/` in order, then runs `supabase/seed.sql` (configured in `supabase/config.toml`).

### Create a new migration

```bash
npm run db:migration:new -- add_feature_name
```

Or:

```bash
supabase migration new add_feature_name
```

Edit the generated file in `supabase/migrations/`. Test with `supabase db reset` before committing.

---

### Applying migrations to hosted projects

Use the Supabase CLI linked to the **target project**. Always confirm the project ref before running.

**Preferred:** merge to `develop` and let GitHub Actions run `supabase db push` on staging. See [github-actions.md](./github-actions.md).

### Staging (manual alternative)

```bash
# Link once per machine (use STAGING project ref)
supabase link --project-ref <STAGING_PROJECT_REF>

# Push pending migrations
supabase db push
```

### Production

Only after staging validation and explicit approval:

```bash
supabase link --project-ref <PRODUCTION_PROJECT_REF>
supabase db push
```

**Never run `supabase db reset` against a hosted staging or production project.**

---

## Current migrations (reference)

| File | Purpose |
|------|---------|
| `20260831000000_initial_schema.sql` | Phase 1 core schema + RLS |
| `20260901000000_phase2_learndash_schema.sql` | LearnDash-compatible tables + backfill |
| `20260901120000_course_builder_rls.sql` | Instructor self-assign on new courses |

After adding migrations, update `types/database.types.ts` if schema types changed.

---

## RLS review checklist

When a migration adds or changes tables:

- [ ] `ENABLE ROW LEVEL SECURITY` on user-facing tables
- [ ] SELECT policies for students, instructors, admins as appropriate
- [ ] INSERT/UPDATE/DELETE policies match application authorization
- [ ] Service-role usage limited to trusted server paths (webhooks, scripts)
- [ ] Course Builder mutations work under anon client + user session (not service role)

---

## Seed data (`supabase/seed.sql`)

- **Synthetic only** — sample courses, modules, lessons
- No real student emails, production WordPress users, or live Stripe IDs
- Auth test users should be created via Supabase Auth API (triggers populate `profiles`)

Seed runs automatically on `supabase db reset`. Do not seed production.

---

## Rollback / recovery

PostgreSQL migrations are forward-only in normal workflow. For destructive changes:

1. Plan a **new migration** to restore or migrate data
2. Take a Supabase backup/snapshot before production promotion
3. Document rollback steps in the PR

If a migration fails mid-deploy on staging, fix the migration file (new commit) and re-run after reset on staging — do not patch production manually without a follow-up migration.

---

## LearnDash import (separate from schema migrations)

Content migration uses Node scripts (not SQL migrations):

```bash
npm run migrate:learndash
npm run migrate:learndash:quizzes
npm run migrate:normalize-content
```

These require `SUPABASE_SERVICE_ROLE_KEY` for the **target environment**. Run against **staging first**. See [migration-mapping.md](./migration-mapping.md).

### Reconciliation targets

After staging import, compare counts for:

- users / profiles
- courses, sections, lessons
- quizzes, questions
- groups, enrollments
- progress, certificates
- Stripe customer / product mappings (production live IDs only in production)

A successful script exit is **not** sufficient — verify counts and spot-check content.

---

## Production protection

- No direct production schema edits outside migrations
- No `supabase db reset` on production
- No automation that silently targets production without explicit `APP_ENV` / project selection
- Emergency SQL fixes must be captured as a new migration immediately
