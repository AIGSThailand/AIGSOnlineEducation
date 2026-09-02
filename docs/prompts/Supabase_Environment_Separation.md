Implement proper **development, staging, and production environment separation** for the AIGS Online Education Platform.

Current stack:
- Next.js App Router
- TypeScript
- Supabase
- Supabase Auth
- Supabase PostgreSQL
- Supabase RLS
- Stripe
- Vercel
- Git
- WordPress + LearnDash migration source

Before making changes:
1. Read `RULES.md`.
2. Inspect the current Supabase configuration.
3. Inspect existing `.env.example`, `.env.local`, deployment configuration, and Supabase migrations.
4. Inspect the current Stripe configuration.
5. Do not modify production data.
6. Do not connect local development to production.
7. Do not run production schema commands.

The target environment model is:

```text
LOCAL
├── Next.js localhost
├── Supabase local
└── Stripe test

STAGING
├── Vercel staging/preview
├── Separate Supabase staging project
└── Stripe test

PRODUCTION
├── Vercel production
├── Separate Supabase production project
└── Stripe live
```

---

# 1. Supabase Environment Separation

The project must support three independent environments:

```text
Local
Staging
Production
```

Local should use Supabase CLI/local development where practical.

Staging must use a dedicated Supabase project.

Production must use a different dedicated Supabase project.

Do not use the same hosted Supabase database for staging and production.

Do not copy production credentials into local development configuration.

---

# 2. Local Supabase

Ensure the repository supports:

```bash
supabase start
supabase stop
supabase status
supabase db reset
```

Verify the repository includes:

```text
supabase/
├── config.toml
├── migrations/
└── seed.sql
```

The local database must be reconstructable using:

```text
all migrations
+
seed.sql
```

Do not require manual SQL changes after `supabase db reset`.

---

# 3. Environment Variables

Update `.env.example` to document required variables.

Use:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

NEXT_PUBLIC_APP_URL=
```

Never put real values in `.env.example`.

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

through `NEXT_PUBLIC_*`.

---

# 4. Local Environment

Local development should use values similar to:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role>

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=<local-webhook-secret>

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Do not hardcode these values into source code.

---

# 5. Staging Environment

Staging must use:

```text
Separate Supabase project
Stripe Test Mode
Staging application URL
Separate webhook secret
```

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=https://STAGING_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role>

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=<staging-webhook-secret>

NEXT_PUBLIC_APP_URL=https://staging.example.com
```

Staging must never contain:

```text
sk_live_*
production Stripe webhook secret
production Supabase service-role key
```

---

# 6. Production Environment

Production must use:

```text
Separate production Supabase project
Stripe Live Mode
Production application URL
Production webhook secret
```

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PRODUCTION_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<production-key>
SUPABASE_SERVICE_ROLE_KEY=<production-service-role>

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=<production-webhook-secret>

NEXT_PUBLIC_APP_URL=https://production-domain.com
```

Do not place any real production values in Git.

---

# 7. Environment Validation

Add a typed environment validation layer if one does not already exist.

Suggested location:

```text
lib/
└── env/
    ├── server.ts
    └── client.ts
```

or another existing project convention.

Validate required variables using Zod.

Server validation should fail clearly if required secrets are missing.

Client-side code should only have access to approved public variables.

Do not expose the entire `process.env` object.

---

# 8. Environment Identification

Add a safe way to identify the runtime environment.

Prefer deployment/runtime configuration such as:

```text
development
staging
production
```

Do not derive security decisions from user-controlled browser values.

If introducing:

```env
APP_ENV=
```

supported values should be:

```text
local
staging
production
```

Validate it.

Do not use `APP_ENV` as the sole security boundary.

---

# 9. Stripe Environment Guard

Add defensive checks so:

```text
local/staging
```

cannot accidentally initialize Stripe with:

```text
sk_live_*
```

Likewise, production should warn or fail if configured with test credentials unless explicitly required for a controlled operation.

Server-side validation should detect obvious mismatches.

Example logic:

```text
APP_ENV=staging
+
STRIPE_SECRET_KEY starts with sk_live_
=
startup/configuration error
```

Do not log the secret value.

---

# 10. Supabase Environment Guard

Ensure the application does not hardcode a Supabase project URL.

All clients must read environment-specific configuration.

Review:

```text
lib/supabase/client.ts
lib/supabase/server.ts
lib/supabase/middleware.ts
lib/supabase/admin.ts
```

There should be no production project identifier hardcoded into these files.

---

# 11. Git Workflow

Document the recommended workflow:

```text
feature/*
   ↓
Pull Request
   ↓
develop
   ↓
Staging
   ↓
QA
   ↓
main
   ↓
Production
```

Recommended mapping:

```text
feature/* -> local / preview
develop   -> staging
main      -> production
```

Do not implement branch-sensitive production secrets directly in source code.

Deployment platform environment configuration should control secrets.

---

# 12. Supabase Migration Workflow

All schema changes must be created as migrations.

Required flow:

```text
Local migration
      ↓
Local test
      ↓
Git commit
      ↓
Staging deployment
      ↓
Staging validation
      ↓
Production promotion
```

Never:

```text
edit staging schema manually
then separately edit production schema manually
```

The same migration file should be applied to both.

---

# 13. Migration Commands

Document safe commands for local development.

Examples:

```bash
supabase migration new <migration_name>
supabase db reset
```

If remote deployment commands are documented, clearly distinguish staging from production.

Never create a script that silently targets production.

---

# 14. Production Protection

Add explicit documentation and safeguards around production operations.

Hard rule:

```text
No direct production schema modifications.
```

All schema changes must be:

```text
migration
→ staging
→ QA
→ production
```

Never run:

```bash
supabase db reset
```

against production.

Do not create automation that can infer and target production without an explicit environment selection.

---

# 15. Seed Data

Review `supabase/seed.sql`.

Ensure it contains only synthetic/testing data.

Allowed:

```text
Test Admin
Test Instructor
Test Student
Sample Course
Sample Lessons
Sample Enrollment
Sample Progress
```

Not allowed:

```text
real student emails
production WordPress users
live Stripe customer IDs
live Stripe subscription IDs
production credentials
real billing records
```

Seed data should be repeatable.

---

# 16. LearnDash Migration Testing

Prepare the environment model for LearnDash migration.

Required sequence:

```text
WordPress / LearnDash
      ↓
Export
      ↓
Migration scripts
      ↓
Supabase Staging
      ↓
Reconciliation
      ↓
Repeat/fix
      ↓
Production migration
```

Do not make the first historical LearnDash import against production.

---

# 17. Migration Reconciliation

Staging migration tests should eventually compare counts for:

```text
users
courses
sections
lessons
topics
quizzes
questions
groups
enrollments
progress
certificates
Stripe customers
Stripe subscriptions
```

The migration is not considered successful merely because the import script exits successfully.

Prepare documentation for reconciliation.

---

# 18. Stripe Migration Safety

Existing Stripe relationships must remain environment-aware.

Production live IDs must not be mixed with staging test objects.

Staging should use:

```text
Stripe test customers
Stripe test subscriptions
Stripe test products/prices
```

Production migration may preserve existing:

```text
stripe_customer_id
stripe_subscription_id
stripe_product_id
stripe_price_id
```

only when they originate from Stripe live mode and have been validated.

---

# 19. Vercel Configuration

Document expected environment configuration for:

```text
Development
Preview
Production
```

Recommended:

```text
Vercel Preview
    -> Supabase Staging
    -> Stripe Test

Vercel Production
    -> Supabase Production
    -> Stripe Live
```

If `develop` has a dedicated staging domain/project, document how it maps to the staging Supabase project.

Do not place environment secrets in `vercel.json`.

---

# 20. Auth URLs

Review Supabase Auth URL configuration.

Document which URLs should be configured for:

```text
localhost
staging
production
```

Ensure password reset, email verification, and callback URLs work in all environments.

Avoid hardcoding the production URL in auth actions.

Use:

```text
NEXT_PUBLIC_APP_URL
```

or an approved equivalent.

---

# 21. Stripe Webhook URLs

Document separate webhook endpoints.

Example:

```text
Local
http://localhost:3000/api/stripe/webhook

Staging
https://staging.example.com/api/stripe/webhook

Production
https://example.com/api/stripe/webhook
```

Each hosted Stripe endpoint must have its own webhook signing secret.

Do not reuse webhook secrets.

---

# 22. Documentation

Create or update:

```text
docs/
├── environments.md
├── deployment.md
└── database-migrations.md
```

`environments.md` should explain:

```text
local
staging
production
environment variables
Supabase projects
Stripe modes
```

`database-migrations.md` should explain:

```text
create migration
test locally
promote to staging
validate
promote to production
rollback/recovery considerations
```

`deployment.md` should explain:

```text
Git branches
Vercel environments
Supabase targets
Stripe targets
```

---

# 23. README

Add a concise environment section to `README.md`.

Include:

```text
Local setup
Staging architecture
Production architecture
Migration workflow
Links to detailed docs
```

Do not overload the README with every operational detail.

---

# 24. AI Agent Safety

Update coding-agent guidance so agents must:

1. Assume local environment by default.
2. Never run commands against production without explicit instruction.
3. Never use production service-role credentials for development.
4. Never use Stripe live keys locally.
5. Never directly modify production schema.
6. Generate migrations instead.
7. Report staging steps separately.
8. Report production promotion steps separately.
9. Warn before destructive operations.
10. Verify environment before operations affecting real users, learning progress, enrollment, certificates, or billing.

---

# 25. Optional CI/CD

If the project already uses GitHub Actions, review whether migrations can be safely automated.

Desired architecture:

```text
develop merge
    ↓
CI
    ↓
apply migrations to staging
    ↓
deploy staging
```

After approval:

```text
main merge
    ↓
CI
    ↓
apply validated migrations to production
    ↓
deploy production
```

Do not create automatic production database deployment unless:
- environment targeting is explicit
- secrets are isolated
- migrations have already passed staging
- failure behavior is understood

If CI/CD is not currently present, document the recommended configuration instead of overengineering it.

---

# 26. Do Not

Do not:

- recreate the production Supabase project
- delete existing production data
- rotate real credentials unless requested
- import production WordPress data
- run the LearnDash migration
- change Stripe live subscriptions
- rewrite current authentication
- rewrite current Course Builder work
- weaken RLS
- manually synchronize schemas outside migrations

The task is environment architecture and safety.

---

# 27. Deliverables

At completion provide:

## Configuration

- Local environment support
- Staging environment support
- Production environment support
- Typed environment validation

## Documentation

```text
docs/environments.md
docs/database-migrations.md
docs/deployment.md
```

## Repository changes

Report:

```text
Files added
Files modified
Environment variables added
Scripts added
Dependencies added
```

## Verification

Confirm:

```text
Local -> Supabase Local + Stripe Test
Staging -> Supabase Staging + Stripe Test
Production -> Supabase Production + Stripe Live
```

## Security

Confirm:

- no secrets committed
- no production credentials exposed
- no hardcoded Supabase production URL
- no production service role used in client code
- no Stripe live key used in staging/local
- migration process protects production

## Commands

Provide the exact commands developers should use for:
- starting local Supabase
- resetting local DB
- creating a migration
- running Next.js locally
- testing Stripe webhooks locally

Do not execute any production database command as part of this task.

The final objective is a clearly separated and safe:

```text
LOCAL
→ STAGING
→ PRODUCTION
```

workflow where the same database migrations are tested locally and in staging before being promoted to the production AIGS LMS.