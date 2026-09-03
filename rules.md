# rules.md

## Project

**Online Education Management System**

Migration target:

- From WordPress + LearnDash
- To Next.js + Supabase
- Existing Stripe customers/subscriptions must be preserved where possible

Primary roles:

- Admin
- Instructor
- Student

Core stack:

- Next.js with App Router
- TypeScript
- Tailwind CSS
- shadcn-style UI primitives (`components/ui/` — custom components, not a full shadcn CLI install)
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage (planned; not yet used for uploads)
- Supabase Row Level Security
- Stripe
- Zod
- Vercel

Related documentation (keep in sync with this file):

- `docs/environments.md` — local / staging / production separation
- `docs/vercel-staging-setup.md` — Vercel staging domain and environment variables
- `docs/github-actions.md` — CI and Supabase migration workflows (staging auto, production manual)
- `docs/deployment.md` — Git, Vercel, Supabase, Stripe targets
- `docs/database-migrations.md` — migration promotion workflow
- `docs/phase-2-schema.md` — LearnDash-compatible schema
- `docs/migration-mapping.md` — WordPress/LearnDash field mapping
- `PROJECT_STATUS.md` — milestone status

---

## 1. General Engineering Rules

1. Use TypeScript for all application code.
2. Enable and preserve strict TypeScript settings.
3. Do not use `any` unless there is a documented technical reason.
4. Prefer small, composable modules over large files.
5. Do not duplicate business logic.
6. Use descriptive names for variables, functions, components, tables, and files.
7. Prefer server-side logic for sensitive operations.
8. Never expose server secrets to browser code.
9. Do not add libraries when the platform or existing stack already solves the problem.
10. Avoid premature abstraction and overengineering.
11. New features must follow existing architecture rather than creating parallel patterns.
12. Code should be readable without excessive comments.
13. Comments should explain _why_, not restate what the code already says.
14. Never commit secrets, credentials, private keys, production exports, or customer data.

---

## 2. Project Structure

This repository uses **App Router paths at the repo root** (no `src/` directory). Path aliases use `@/*` from the project root (`tsconfig.json`).

Use these boundaries:

```text
app/            Routes, layouts, pages, route handlers
components/     Reusable presentation/UI components
features/       Business logic grouped by LMS domain
lib/            Shared infrastructure and integrations
types/          Shared TypeScript types

supabase/
  migrations/   SQL database migrations
  seed.sql      Safe local development seed data

scripts/        Migration and maintenance scripts (see §17)
docs/           Architecture and migration documentation
```

### Folder responsibilities

#### `app/`

Use only for:

- route definitions
- layouts
- page composition
- Server Components
- route handlers
- loading/error/not-found boundaries

Do not place complex LMS business logic directly in page files.

#### `components/`

Use for reusable UI.

Examples:

```text
components/
  ui/
  auth/
  layout/
  dashboard/
  courses/
    builder/    Course Builder (admin + instructor)
  stripe/
```

`components/ui/` contains **project-level UI primitives** styled in the shadcn tradition (button, input, card, dialog, sheet, etc.). There is no `components.json`; add primitives here when needed rather than installing competing libraries.

#### `features/`

Business logic should be grouped by domain.

```text
features/
  courses/          Implemented (actions, queries, schema, permissions, builder/)
  enrollments/      README stub — implement when building enrollment UI
  progress/         README stub
  quizzes/          README stub
  topics/           README stub
  groups/           README stub
  certificates/     README stub
```

A feature may contain:

```text
actions.ts
queries.ts
schema.ts
types.ts
permissions.ts
builder/            For complex authoring UIs (courses)
```

Add new feature folders only when the feature is actually implemented. Prefer extending an existing feature over creating parallel patterns.

Validation may also live in `lib/validations/` for shared or legacy schemas; new domain validation should go in `features/<domain>/schema.ts`.

#### `lib/`

Use for infrastructure shared across domains.

Examples:

```text
lib/
  supabase/
  stripe/
  auth/
  validations/
  utils/
```

---

## 3. Next.js Rules

1. Use the App Router.
2. Use Server Components by default.
3. Add `"use client"` only when client-side behavior is required.
4. Do not convert an entire page into a Client Component for one interactive child.
5. Prefer Server Actions for authenticated application mutations when appropriate.
6. Use Route Handlers for:
   - Stripe webhooks
   - external integrations
   - public APIs
   - endpoints requiring raw request bodies
7. Keep authentication and authorization checks server-side.
8. Do not depend on middleware as the only authorization layer.
9. Use `loading.tsx`, `error.tsx`, and `not-found.tsx` where they improve UX.
10. Avoid unnecessary client-side fetching if the data can be fetched in a Server Component.
11. Validate all mutation inputs.
12. Handle expected errors explicitly.
13. Never return secret/internal fields to the client.

---

## 4. Supabase Rules

Supabase is the primary application backend.

Use it for:

- authentication
- PostgreSQL
- storage
- Row Level Security
- realtime only when realtime behavior is genuinely required

### Clients

Maintain separate clients for:

```text
lib/supabase/client.ts
lib/supabase/server.ts
lib/supabase/admin.ts
```

Rules:

- Browser client may use only public/publishable credentials.
- Server client must respect the authenticated user session.
- Admin/service-role client must only execute in trusted server code.
- Never import the admin client into a Client Component.
- Never expose the service-role key.

---

## 5. Database Rules

PostgreSQL is the source of truth for LMS application data.

Use relational modeling rather than storing core relationships in JSON.

Core entities (Phase 1 — still used by student-facing UI):

```text
profiles
courses
course_instructors
modules          Deprecated name; mirrored to course_sections (same UUIDs)
lessons
enrollments
lesson_progress
subscriptions
```

Phase 2 entities (LearnDash-compatible schema — see `docs/phase-2-schema.md`):

```text
course_sections
course_steps
topics
quizzes
questions
question_options
quiz_questions
quiz_attempts
quiz_attempt_answers
groups
group_users
group_leaders
group_courses
certificate_templates
certificate_rules
earned_certificates
step_progress
topic_progress
```

Future / not yet implemented in UI:

```text
assignments
assignment_submissions
announcements
```

### Phase 1 ↔ Phase 2 compatibility (dual-write)

Until the student UI reads fully from `course_steps`:

- **Course Builder** and new structural mutations write to **both** `modules` and `course_sections` (same UUID), and **both** `lessons` and `course_steps`.
- Sync logic lives in `features/courses/builder/sync.ts`.
- **`lessons.sort_order`** is module-local; **`course_steps.sort_order`** for top-level steps is **course-wide unique** (`uq_course_step_order`). Never copy module-local order directly into `course_steps` without allocating a global slot.

Not yet implemented in UI:

```text
topics
quizzes (authoring/attempt UI)
certificates UI
group management UI
full course_steps syllabus on public course pages
```

### Database conventions

1. Use `uuid` primary keys unless there is a compelling reason not to.
2. Use foreign-key constraints.
3. Add indexes for commonly filtered/joined foreign keys.
4. Use `created_at` and `updated_at` consistently.
5. Prefer `timestamptz`.
6. Use database constraints for invariants where possible.
7. Use unique constraints where duplicates would be invalid.
8. Use enums only for stable, small domain values.
9. Do not make client-generated data authoritative if it can be calculated or verified server-side.
10. Never manually edit the production schema outside the migration process.

---

## 6. Database Migrations

All schema changes must be represented by SQL migrations.

Store them under:

```text
supabase/migrations/
```

Rules:

1. Never change an already-applied production migration.
2. Create a new migration for every schema change.
3. Migration filenames must be descriptive.
4. Migrations must include RLS changes when new tables require them.
5. Test migrations locally/staging before production.
6. Avoid destructive migrations without a rollback/data preservation plan.
7. Never drop legacy migration IDs until reconciliation is complete.

---

## 7. Authentication

Use Supabase Auth.

Required flows:

- login
- logout
- forgot password
- reset password
- protected application routes

User application data belongs in `profiles`, linked to `auth.users`.

### Roles

Supported roles:

```text
admin
instructor
student
```

Do not use client UI checks as authorization.

Correct:

```text
User request
  -> authenticated session
  -> server authorization check
  -> RLS/database policy
  -> data
```

Incorrect:

```text
if (user.role === "admin") {
  showAdminButton()
}
```

The UI check can improve UX, but it is never security.

### Role redirects

After authentication:

```text
admin       -> /admin/dashboard
instructor  -> /instructor/dashboard
student     -> /student/dashboard
```

---

## 8. Row Level Security

RLS must be enabled for user-accessible LMS tables.

Default rule:

> Deny access unless an explicit policy grants it.

Examples:

### Students

Students may:

- read/update their own profile where appropriate
- read their own enrollments
- read/write their own progress
- access course content only when enrollment permits it
- read their own submissions and results

Students may not:

- modify another student's records
- modify enrollment authority
- assign themselves paid courses
- change subscription status

### Instructors

Instructors may:

- access assigned courses
- manage allowed content for assigned courses
- see students enrolled in assigned courses
- grade submissions for assigned courses

Instructors may not receive global admin access.

### Admins

Admins may manage LMS application data, but sensitive operations must still be implemented intentionally.

### Service Role

Service-role access is reserved for:

- trusted migration scripts
- Stripe webhooks
- carefully controlled administrative jobs

Never use service-role credentials to avoid designing proper RLS.

---

## 9. Authorization Helpers

Centralize common authorization checks.

Current implementation:

```text
lib/auth/
  permissions.ts    getCurrentUser(), requireAuth(), requireRole(), canAccessCourse()
  redirects.ts      Post-login role redirects

features/courses/
  permissions.ts    canManageCourse(), requireCourseManage(), requireCourseBuilderAccess()
```

Feature-specific permission rules should live beside the feature (e.g. `features/courses/permissions.ts`).

Avoid repeating authorization logic across pages.

---

## 10. UI Design System

Use:

- Tailwind CSS for styling/layout
- Project UI primitives in `components/ui/` (shadcn-inspired; extend in place)
- Lucide icons unless a different icon system is deliberately selected

Do not mix multiple competing component libraries. Do not assume the full shadcn CLI/Radix catalog is installed — check `components/ui/` before adding dependencies.

### UI principles

The LMS should feel:

- clear
- calm
- professional
- trustworthy
- accessible
- education-focused

Prefer usability over decorative effects.

### Design tokens

Use CSS variables/design tokens for:

- colors
- spacing
- border radius
- typography
- surfaces

Avoid hardcoding arbitrary colors throughout components.

### Spacing

Prefer Tailwind's standard spacing scale.

Use consistent patterns for:

- page gaps
- section gaps
- card padding
- form spacing
- table density

### Components

Use reusable primitives for:

- buttons
- inputs
- textarea
- select
- checkbox
- radio
- switch
- card
- badge
- alert
- dialog
- sheet
- dropdown menu
- table
- tabs
- tooltip
- toast
- skeleton
- pagination

Do not recreate a component if a suitable primitive already exists in `components/ui/`. Add missing primitives there when needed (dialog, sheet, skeleton, etc. are already present).

---

## 11. LMS UI Patterns

Create project-level reusable components for:

```text
CourseCard
CourseProgress
EnrollmentStatus
LessonNavigation
ModuleAccordion
LessonPlayer
AssignmentRow
QuizCard
CertificateCard
EmptyState
PermissionDenied
DashboardStat
```

Role dashboards should share visual primitives but may have different information architecture.

### Student dashboard

Prioritize:

- continue learning
- active courses
- progress
- upcoming assignments
- recent results/certificates

### Instructor dashboard

Prioritize:

- assigned courses
- students
- grading work
- content management
- course activity

### Admin dashboard

Prioritize:

- users
- enrollments
- courses
- instructors
- subscriptions
- operational reporting

---

## 12. Responsive Design

All application screens must support:

- desktop
- tablet
- mobile

Do not build desktop-only dashboards.

Expected behavior:

- responsive sidebar
- mobile navigation
- usable data tables or mobile alternatives
- large touch targets
- readable forms
- no horizontal overflow under normal use

---

## 13. Accessibility

Accessibility is required, not optional.

Rules:

1. Use semantic HTML.
2. All form fields need proper labels.
3. Maintain visible keyboard focus states.
4. Interactive elements must be keyboard accessible.
5. Do not communicate status using color alone.
6. Maintain sufficient color contrast.
7. Images require appropriate alt text.
8. Decorative images should not create screen-reader noise.
9. Dialogs must manage focus correctly.
10. Validation errors should be associated with inputs.
11. Interactive target sizes must remain usable on touch devices.
12. Use accessible shadcn/Radix primitives rather than rebuilding complex interactions.

---

## 14. Forms and Validation

Use Zod for input validation where appropriate.

Validation must happen on trusted server boundaries even if client-side validation also exists.

Pattern:

```text
Form
 -> client usability validation
 -> Server Action / Route Handler
 -> Zod validation
 -> authorization
 -> database mutation
```

Do not trust:

- hidden fields
- user IDs from browser state
- prices sent by the browser
- roles sent by the browser
- subscription status sent by the browser

Derive sensitive values server-side.

---

## 15. Stripe Rules

The existing Stripe account remains authoritative for payment events.

### Checkout modes

The platform supports both:

- **One-time course checkout** (current primary enrollment path via `BuyCourseButton` / `checkout.session.completed`)
- **Subscriptions** (webhook handlers present; use when product requirements call for recurring billing)

Do not assume all enrollments are subscription-based.

Whenever possible, preserve:

- Stripe customer IDs
- subscription IDs
- product IDs
- price IDs

Do not create replacement subscriptions for migrated users unless migration requirements explicitly require it.

### Stripe architecture

```text
Stripe
  -> webhook
  -> Next.js Route Handler
  -> verify signature
  -> trusted server logic
  -> Supabase
```

### Webhooks

Prepare for:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

Rules:

1. Always verify Stripe webhook signatures.
2. Webhook processing must be idempotent.
3. Do not trust client redirects as confirmation of payment.
4. Stripe-derived payment and subscription state should be synchronized server-side.
5. Never let users directly modify payment status or Stripe IDs (instructor UI must not edit Stripe mapping; admin Course Builder settings only).
6. Never expose Stripe secret keys.

---

## 16. Enrollment Rules

Course access must be determined by application authorization logic plus database policies.

Possible enrollment sources (matches `enrollment_source` enum in schema):

```text
manual
stripe
migration
group
admin
```

`group` corresponds to LearnDash group-based access (`groups`, `group_users`, `group_courses`).

Do not assume every enrollment is paid.

Store enough metadata to determine how access was granted.

Enrollment mutations that grant paid access must never be client-authoritative.

---

## 17. LearnDash Migration

The current WordPress/LearnDash platform is a legacy source during migration.

Preserve legacy IDs where useful (nullable; see `docs/migration-mapping.md`):

```text
wordpress_user_id
wordpress_course_id
wordpress_lesson_id
wordpress_section_id
wordpress_group_id
wordpress_quiz_id
wordpress_question_id
wordpress_certificate_id
```

### Migration scripts

Migration tooling lives under `scripts/` (not `scripts/migration/`):

```text
scripts/
  migrate-learndash.mjs           Courses, sections, lessons, course_steps
  migrate-learndash-quizzes.mjs   Quizzes, questions (partial — MCQ options need ProQuiz DB)
  normalize-wordpress-content.mjs   Strip Gutenberg markup in descriptions/content
  lib/wordpress-content.mjs       Shared HTML helpers for scripts
```

Run via npm:

```text
npm run migrate:learndash
npm run migrate:learndash:quizzes
npm run migrate:normalize-content
```

Do not put one-off migration logic into application API routes.

### Migration process

Migration scripts should support:

```text
extract
transform
validate
import
reconcile
```

Where practical, migration jobs should be repeatable/idempotent.

Never assume a migration succeeded because the script completed.

Reconcile:

- total users
- courses
- lessons
- enrollments
- completion/progress
- Stripe mappings
- certificates if migrated
- important metadata

Keep the old platform available in read-only form during the initial production stabilization period.

---

## 18. Legacy Password Migration

Do not assume WordPress password hashes can simply be copied into Supabase Auth.

The authentication migration approach must be documented separately.

Possible strategies:

- password reset migration
- one-time legacy credential validation followed by Supabase account migration
- approved identity migration mechanism

Do not weaken authentication security to avoid a password reset.

---

## 19. Media and Storage

Use Supabase Storage only after determining whether it is suitable for the asset type.

Examples:

- profile images
- PDFs
- assignments
- certificates
- course attachments

Large video delivery may require a dedicated video platform/CDN.

Do not store large video binaries directly in PostgreSQL.

Use signed URLs/private buckets for protected assets when appropriate.

---

## 20. Data Privacy

Treat education and billing information as sensitive application data.

Rules:

1. Query only the data needed for the current operation.
2. Do not log passwords, tokens, card data, private keys, or sensitive payloads.
3. Avoid storing Stripe card data. Stripe owns payment-card handling.
4. Do not put PII into URLs unnecessarily.
5. Restrict service-role access.
6. Production exports must be protected and removed when no longer needed.
7. Never use production user data as development seed data without proper sanitization and authorization.

---

## 21. Environment Variables

Use `.env.local` for local secrets.

Commit `.env.example` containing names only.

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

NEXT_PUBLIC_APP_URL=
```

Use the names in `.env.example` — the Supabase anon key is `NEXT_PUBLIC_SUPABASE_ANON_KEY`, not `PUBLISHABLE_KEY`.

Rules:

- variables beginning with `NEXT_PUBLIC_` are browser-visible
- never place a secret in a `NEXT_PUBLIC_` variable
- validate required server environment variables at startup where practical

---

## 22. Error Handling

Do not silently swallow errors.

Errors should be categorized as:

- validation error
- authentication error
- authorization error
- not found
- conflict/business rule
- integration error
- unexpected server error

User-facing messages should be useful without exposing:

- SQL
- stack traces
- keys/tokens
- sensitive infrastructure details

Log enough context server-side for troubleshooting.

---

## 23. Loading and Empty States

Every meaningful asynchronous screen should account for:

- loading
- empty data
- success
- recoverable error
- fatal error

Prefer skeletons for dashboard/content loading.

Empty states should explain:

- what is empty
- why it might be empty
- what action is available

---

## 24. Performance

1. Fetch only required columns.
2. Paginate large result sets.
3. Add indexes based on actual query patterns.
4. Avoid N+1 database queries.
5. Prefer server-side data access.
6. Optimize images using Next.js image tooling where appropriate.
7. Lazy-load heavy client functionality.
8. Do not add Realtime subscriptions to data that does not need realtime updates.
9. Do not cache user-specific/private data incorrectly.

---

## 25. Naming Conventions

### Files

Use kebab-case:

```text
course-card.tsx
require-role.ts
stripe-webhook.ts
```

### Components

Use PascalCase:

```ts
CourseCard;
StudentDashboard;
LessonNavigation;
```

### Functions and variables

Use camelCase:

```ts
getCourseById();
studentEnrollment;
```

### Database

Use snake_case:

```text
course_instructors
lesson_progress
stripe_customer_id
```

### Environment variables

Use uppercase snake case:

```text
STRIPE_SECRET_KEY
NEXT_PUBLIC_SUPABASE_URL
```

---

## 26. Testing

Critical business paths must be tested.

Highest priority scenarios:

1. User authentication
2. Role authorization
3. Student cannot access another student's records
4. Student cannot self-enroll into paid content
5. Instructor cannot modify an unrelated course
6. Admin permissions
7. Course enrollment access
8. Lesson progress
9. Stripe webhook verification
10. Subscription status changes
11. Migrated user/course reconciliation

Add tests for bugs that could cause:

- unauthorized access
- billing errors
- enrollment errors
- loss of progress
- migration corruption

---

## 27. Git and Pull Requests

Keep changes focused.

Commit messages should explain the change.

Before merging:

- TypeScript passes
- lint passes
- tests pass where applicable
- migrations reviewed
- RLS reviewed for database changes
- secrets are not present
- responsive UI checked
- permission behavior checked

Large unrelated refactors should not be mixed into feature PRs.

---

## 28. Feature Definition of Done

A feature is not complete when only the UI works.

For each feature verify:

- UI
- responsive behavior
- server logic
- validation
- authentication
- authorization
- RLS
- loading state
- empty state
- error state
- database constraints
- accessibility
- observability/logging where needed
- tests for critical paths

---

## 29. Implementation Phases

### Phase 1 — Foundation (complete)

1. Next.js foundation
2. Tailwind + UI primitives
3. Supabase integration
4. Authentication
5. Profiles and role system
6. RLS
7. Protected dashboard layouts
8. Courses, modules, lessons (read/enroll/learn)
9. Enrollments and lesson progress
10. Stripe webhook infrastructure
11. **Course Builder** (admin + instructor): create/edit courses, modules, lessons, publish — `features/courses/`, `components/courses/builder/`

### Phase 2 — Schema & migration (in progress)

- LearnDash-compatible tables (`course_sections`, `course_steps`, quizzes, groups, certificates)
- Import scripts for courses/lessons/quizzes
- Dual-write from Course Builder to Phase 2 tables
- See `supabase/migrations/20260901000000_phase2_learndash_schema.sql`

### Phase 3 — Not yet prioritized

- Quiz authoring and student attempt UI
- Topics nested under lessons
- Certificates UI
- Group management UI
- Student syllabus from `course_steps` (replace legacy `modules` queries)
- Advanced assignments, reporting, gamification, realtime

The objective remains a secure, maintainable platform — visual polish comes after authorization, RLS, and data integrity.

---

## 30. AI Coding Agent Rules

When an AI coding agent works on this repository, it must:

1. Read this file before making architectural changes.
2. Inspect existing code before creating new patterns.
3. Reuse current components/utilities where appropriate.
4. Do not invent database columns without checking the schema.
5. Do not weaken RLS to make a feature work.
6. Do not use service-role credentials from client code.
7. Do not bypass authorization.
8. Do not install packages without explaining why they are required.
9. Keep modifications scoped to the requested task.
10. Do not remove legacy migration fields without explicit approval.
11. Do not alter Stripe IDs during migration unless explicitly required.
12. Avoid large rewrites when a focused change solves the problem.
13. Follow Next.js App Router conventions.
14. Use Server Components by default.
15. Use `components/ui/` primitives before creating competing generic UI components.
16. Validate user-controlled input.
17. Run/type-check/lint relevant code after changes where tooling permits.
18. Report migrations, environment variable changes, and security implications in the completion summary.

---

## 31. Architecture Decision Priority

When two approaches are possible, prefer the one that gives:

1. stronger security
2. clearer authorization
3. easier maintenance
4. simpler migration
5. better data integrity
6. good user experience
7. reasonable performance
8. lower operational complexity

Avoid clever architecture when a standard Next.js + PostgreSQL approach is sufficient.

---

## 32. Core Principle

> UI visibility is not authorization.

All sensitive LMS operations must be protected at the server/database layer.

For this project, authentication, authorization, RLS, Stripe integrity, enrollment integrity, and migration accuracy take priority over visual polish.

---

## 33. Environment Separation & Deployment Promotion

The project must use separate environments for local development, staging/testing, and production.

Required environment model:

```text
Local Development
      ↓
Supabase Local
      ↓
Staging / Testing
      ↓
Supabase Staging
      ↓
Production
      ↓
Supabase Production
```

Recommended project naming:

```text
AIGS Local
AIGS Staging
AIGS Production
```

### Environment isolation rules

1. Local development must not use the production Supabase database.
2. Staging must use a separate Supabase project from production.
3. Production data must not be used as normal development or seed data.
4. Production credentials must never be stored in local `.env` files used for routine development.
5. Staging and production must have separate Supabase URLs, publishable keys, service-role keys, databases, Auth users, Storage buckets, and Stripe webhook secrets.
6. Local and staging must use Stripe test mode.
7. Production must use Stripe live mode.
8. Staging must never point at Stripe live credentials.
9. Local development should use Supabase local and Stripe test tooling whenever practical.
10. Production schema changes must be promoted from committed, staging-tested migrations.

### Local development

Developers should run Supabase locally where practical:

```bash
supabase init
supabase start
```

Local schema must be reconstructable from committed migrations and safe seed data.

Do not use real student PII, billing data, or unsanitized production exports as development seed data.

### Staging

Staging is the required validation environment before production.

Use staging to test database migrations, RLS changes, authentication, Course Builder changes, Stripe webhooks, subscription access, LearnDash imports, assessments, group access, certificates, and migration reconciliation.

### Production

Production contains authoritative live users, enrollments, progress, assessment history, certificates, Stripe mappings, and migrated LearnDash records.

Production must not be used for feature development or exploratory testing.

---

## 34. Environment Variables by Environment

Configure environment variables independently for local, staging, and production.

### Local

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Staging

```env
NEXT_PUBLIC_SUPABASE_URL=https://STAGING_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=

NEXT_PUBLIC_APP_URL=https://STAGING_APP_URL
```

### Production

```env
NEXT_PUBLIC_SUPABASE_URL=https://PRODUCTION_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=

NEXT_PUBLIC_APP_URL=https://PRODUCTION_APP_URL
```

Rules:

1. Never place production secrets in `.env.example`.
2. Never expose secrets through `NEXT_PUBLIC_`.
3. Never reuse Stripe webhook secrets across staging and production.
4. Never reuse Supabase service-role keys across projects.
5. Store deployment secrets using environment-specific configuration in the deployment platform.

---

## 35. Git & Environment Promotion Workflow

Recommended promotion flow:

```text
feature/*
   ↓
Pull Request
   ↓
develop
   ↓
Staging
   ↓
QA / Validation
   ↓
main
   ↓
Production
```

Recommended environment mapping:

```text
feature/*  -> local / preview
develop    -> staging
main       -> production
```

Production changes must be promoted from reviewed and tested code. Do not make production-only code changes that are absent from Git.

---

## 36. Database Migration Promotion Rules

All database schema changes must use the same committed migration history.

Required flow:

```text
Create migration locally
      ↓
Test locally
      ↓
Commit migration
      ↓
Apply to staging
      ↓
Validate staging
      ↓
Promote the same migration
      ↓
Apply to production
```

Rules:

1. Never maintain different staging and production schemas manually.
2. The same committed migration validated in staging must be promoted to production.
3. Never make ad-hoc production schema changes that are not represented in Git.
4. Never edit an already-applied production migration.
5. Fix schema problems by creating a new migration.
6. Include RLS, triggers, functions, indexes, and constraints in migration history.
7. Security/access changes require RLS review.
8. Destructive migrations require a data-preservation and rollback plan.
9. Production migrations must not depend on local-only seed data.

Recommended local validation:

```bash
supabase db reset
```

The local database should be reproducible from all committed migrations plus safe seed data.

---

## 37. Production Database Protection

Hard rule:

> No developer or AI coding agent may apply schema changes directly to the production Supabase database. All schema changes must be represented as committed migrations, validated locally and on staging, then promoted to production.

Additional rules:

1. Do not use production service-role credentials for routine development.
2. Do not use the production SQL editor for undocumented schema changes.
3. Emergency fixes must be captured immediately as a migration.
4. Do not run experimental SQL against production.
5. Do not truncate or reset production tables.
6. Never run `supabase db reset` against production.
7. Do not seed production with development seed data.
8. Destructive production changes require explicit approval and verified recovery options.

---

## 38. Seed Data Rules

`supabase/seed.sql` is for local/testing data unless a deployment procedure explicitly states otherwise.

Seed data must be synthetic, free of live PII, free of live Stripe IDs, free of production credentials, and safe to recreate.

Recommended seed entities include a test admin, instructor, student, sample course, lessons, enrollment, and progress.

---

## 39. LearnDash Migration Environment Rules

Historical LearnDash migration must be tested against staging before production.

Required workflow:

```text
WordPress / LearnDash Source
          ↓
Secure Export
          ↓
Migration Tooling
          ↓
Supabase Staging
          ↓
Validation
          ↓
Reconciliation Report
          ↓
Fix / Repeat
          ↓
Production Migration
```

Do not make the first full LearnDash import against production.

At minimum reconcile users, courses, sections, lessons, topics, quizzes, questions, groups, enrollments, progress, certificates, Stripe customer mappings, and Stripe subscription mappings.

Migration tooling should be repeatable/idempotent where practical.

A migration run is not successful merely because the script completed without error.

---

## 40. Stripe Environment Rules

Required mapping:

```text
Local       -> Stripe Test
Staging     -> Stripe Test
Production  -> Stripe Live
```

Rules:

1. Never use `sk_live_*` locally or in staging.
2. Never use production webhook secrets in staging.
3. Staging webhooks must target staging URLs.
4. Production webhooks must target production URLs.
5. Stripe test customers/subscriptions must never be treated as production records.
6. Existing live Stripe IDs must only be reconciled/imported into production through the approved migration process.

---

## 41. AI Agent Environment Safety

Before an AI coding agent changes database or deployment configuration, it must determine the target environment.

The agent must:

1. Default to local development when the target is not explicitly known.
2. Never assume credentials refer to staging or production.
3. Never run production schema commands automatically.
4. Never use production service-role credentials for local tasks.
5. Never replace staging credentials with production credentials.
6. Create migrations instead of directly editing hosted schemas.
7. Report new environment variables required.
8. Report migrations that must be applied to staging.
9. Report production promotion steps separately.
10. Flag destructive or irreversible operations before execution.

If an operation could affect real users, enrollments, progress, certificates, or billing, the environment must be verified before execution.
