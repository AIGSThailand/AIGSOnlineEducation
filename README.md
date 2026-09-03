# AIGS Online Education Platform (LMS)

A production-ready Online Education Management System built on Next.js App Router, Supabase (PostgreSQL, Auth, RLS, Storage), and Stripe subscription billing. Engineered to replace legacy WordPress + LearnDash platforms with modern performance, security, and developer ergonomics.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites & Installation](#2-prerequisites--installation)
3. [Environment Variables](#3-environment-variables)
4. [Supabase Setup & Database Schema](#4-supabase-setup--database-schema)
5. [Running Migrations & Seeding](#5-running-migrations--seeding)
6. [Authentication & Session Flow](#6-authentication--session-flow)
7. [Roles & Row Level Security (RLS)](#7-roles--row-level-security-rls)
8. [Stripe Webhook Configuration](#8-stripe-webhook-configuration)
9. [Local Development Commands](#9-local-development-commands)
10. [Deployment to Vercel](#10-deployment-to-vercel)
11. [LearnDash Migration Strategy](#11-learndash-migration-strategy)

---

## 1. Architecture Overview

- **Framework**: Next.js 14+ (App Router, Server Components by default, Client Components for interactive UI)
- **Language**: Strict TypeScript (`strict: true`, no `any`)
- **Database & Auth**: Supabase PostgreSQL with native Row Level Security (RLS) & `@supabase/ssr` cookie authentication
- **Payments**: Stripe Node SDK & Webhooks (`@stripe/stripe-js`, `stripe`)
- **Form Validation**: Zod runtime schema validation
- **Styling**: Tailwind CSS & Lucide React icons

```text
app/
├── (auth)/                   # Authentication routes (Login, Register, Password Reset)
├── admin/                    # Admin portal (Users, Courses, Enrollments, Reports)
├── instructor/               # Instructor portal (Courses, Students, Assignments, Quizzes)
├── student/                  # Student portal (Dashboard, My Courses, Grades, Certificates)
├── courses/                  # Public Catalog & Enrolled Lesson Viewer
└── api/
    ├── auth/callback/        # PKCE & Auth Code Exchange
    └── stripe/webhook/       # Stripe Raw Body Webhook Ingestion
```

---

## 2. Prerequisites & Installation

### Requirements

- **Node.js**: v18.17.0+ (or v20.x recommended)
- **Package Manager**: `npm`, `pnpm`, or `yarn`
- **Supabase Account**: Local CLI or cloud project at [supabase.com](https://supabase.com)
- **Stripe Account**: Developer dashboard at [stripe.com](https://stripe.com)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd AIGSOnlineEducation

# Install dependencies
npm install
```

---

## 3. Environment Variables

Create `.env.local` from the template and configure for **local** development:

```bash
cp .env.example .env.local
```

See **[docs/environments.md](./docs/environments.md)** for the full local / staging / production model.

Minimal local values:

```ini
APP_ENV=local
NEXT_PUBLIC_APP_URL=http://localhost:3000

# From `supabase status` after `npm run supabase:start`
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Validated at runtime via `lib/env/` (Zod + Stripe/Supabase environment guards).

---

## 3a. Environments (summary)

| Environment    | Supabase                         | Stripe |
| -------------- | -------------------------------- | ------ |
| **Local**      | Supabase CLI (`127.0.0.1:54321`) | Test   |
| **Staging**    | Dedicated hosted project         | Test   |
| **Production** | Separate hosted project          | Live   |

- [docs/environments.md](./docs/environments.md) — variables, Auth URLs, webhooks
- [docs/deployment.md](./docs/deployment.md) — Git branches, Vercel scopes
- [docs/vercel-staging-setup.md](./docs/vercel-staging-setup.md) — staging domain + Vercel env vars
- [docs/github-actions.md](./docs/github-actions.md) — CI and Supabase migration deploy
- [docs/database-migrations.md](./docs/database-migrations.md) — migration promotion

---

## 4. Supabase Setup & Database Schema

The initial database migration (`supabase/migrations/20260831000000_initial_schema.sql`) creates the core tables:

| Table                | Purpose                                                     | LearnDash Foreign ID      |
| -------------------- | ----------------------------------------------------------- | ------------------------- |
| `profiles`           | User profiles with roles (`admin`, `instructor`, `student`) | `wordpress_user_id`       |
| `courses`            | Published and draft learning tracks                         | `wordpress_course_id`     |
| `course_instructors` | Many-to-many relationship linking courses to instructors    | —                         |
| `modules`            | Curriculum sections inside a course                         | —                         |
| `lessons`            | Video/text lessons with sorting                             | `wordpress_lesson_id`     |
| `enrollments`        | Active/completed student registrations                      | `wordpress_enrollment_id` |
| `lesson_progress`    | Per-lesson completion tracking                              | —                         |
| `subscriptions`      | Stripe subscription state reconciliation                    | —                         |

---

## 5. Running Migrations & Seeding

### Option A: Supabase CLI (recommended)

```bash
# Start local Supabase (Docker required)
npm run supabase:start
npm run supabase:status    # copy URL and keys to .env.local

# Apply all migrations + seed.sql
npm run supabase:reset

# Create a new migration
npm run db:migration:new -- your_migration_name
```

Local DB is reproducible from `supabase/migrations/` + `supabase/seed.sql` with no manual SQL steps.

See [docs/database-migrations.md](./docs/database-migrations.md) for staging/production promotion.

### Option B: Supabase Cloud Dashboard (staging/production only)

Apply committed migration files in order via SQL Editor or `supabase db push` after linking the target project. **Do not** patch production schema manually outside migrations.

## 6. Authentication & Session Flow

1. **Sign Up**: The user registers at `/register`. Supabase Auth fires a database trigger (`on_auth_user_created`) that automatically inserts a matching record in `public.profiles` with the designated role.
2. **Sign In**: User signs in at `/login`. The Server Action validates credentials and determines the appropriate landing route:
   - Admin $\rightarrow$ `/admin/dashboard`
   - Instructor $\rightarrow$ `/instructor/dashboard`
   - Student $\rightarrow$ `/student/dashboard`
3. **Session Refresh**: `middleware.ts` runs on all App Router routes using `@supabase/ssr` to ensure tokens are silently refreshed and cookies forwarded.
4. **Password Reset**: Requests from `/forgot-password` generate email recovery links returning to `/reset-password` through `/api/auth/callback`.

---

## 7. Roles & Row Level Security (RLS)

Authorization is implemented with **Defense-in-Depth**:

1. **Middleware & Server Guards**: `requireRole(['admin'])` and `requireAuth()` check credentials before Server Component execution.
2. **PostgreSQL RLS**:
   - `profiles`: Users read and edit their own record; Instructors can see enrolled students; Admins can see all.
   - `courses`: Public can view `published` courses; Instructors edit assigned courses; Admins edit all.
   - `lessons`: Active students and assigned instructors can access lesson content; Admins have full access.
   - `enrollments`: Students view their own courses; Instructors view courses they teach.
   - `subscriptions`: Maintained securely by the Stripe webhook server client.

---

## 8. Stripe Webhook Configuration

### Webhook Endpoint: `/api/stripe/webhook`

Supported Events:

- `checkout.session.completed` (Creates subscription & auto-enrolls student)
- `customer.subscription.created` (Syncs period end & price)
- `customer.subscription.updated` (Updates status e.g. `past_due`, `canceled`)
- `customer.subscription.deleted` (Deactivates subscription access)
- `invoice.paid` / `invoice.payment_failed` (Logs status)

### Local Webhook Forwarding with Stripe CLI:

```bash
# Login to Stripe CLI
stripe login

# Forward webhook events to localhost
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the printed `whsec_...` secret into your `STRIPE_WEBHOOK_SECRET` in `.env.local`.

---

## 9. Local Development Commands

```bash
npm run supabase:start   # Local Supabase (first time / after reboot)
npm run supabase:reset   # Migrations + seed
npm run dev              # Next.js at http://localhost:3000
npm run lint
npm run build
```

### Stripe webhooks (local)

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy whsec_... to STRIPE_WEBHOOK_SECRET in .env.local
```

## 10. Deployment to Vercel

See **[docs/deployment.md](./docs/deployment.md)** for branch mapping, Vercel environment scopes, and checklists.

Summary:

1. Push to GitHub/GitLab.
2. Import into [Vercel](https://vercel.com).
3. Set environment variables per scope (Preview → staging Supabase + Stripe test; Production → production Supabase + Stripe live).
4. Register Stripe webhooks per environment (separate `STRIPE_WEBHOOK_SECRET` each).
5. Configure Supabase Auth redirect URLs using `NEXT_PUBLIC_APP_URL` for each project.

---

## 11. LearnDash Migration Strategy

To support the migration from WordPress + LearnDash, all tables include nullable legacy IDs:

- `profiles.wordpress_user_id`
- `courses.wordpress_course_id`
- `lessons.wordpress_lesson_id`
- `enrollments.wordpress_enrollment_id`

### Migration scripts

```text
scripts/
  migrate-learndash.mjs
  migrate-learndash-quizzes.mjs
  normalize-wordpress-content.mjs
  lib/wordpress-content.mjs
```

Run against **staging first**. Requires `SUPABASE_SERVICE_ROLE_KEY` for the target environment only — never commit exports or production credentials. See [docs/environments.md](./docs/environments.md).
