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

Create `.env.local` in the project root:

```bash
cp .env.example .env.local
```

Populate the variables:

```ini
# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase (Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Server-Side Only: NEVER EXPOSE TO CLIENT
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51...
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 4. Supabase Setup & Database Schema

The initial database migration (`supabase/migrations/20260831000000_initial_schema.sql`) creates the core tables:

| Table | Purpose | LearnDash Foreign ID |
|---|---|---|
| `profiles` | User profiles with roles (`admin`, `instructor`, `student`) | `wordpress_user_id` |
| `courses` | Published and draft learning tracks | `wordpress_course_id` |
| `course_instructors` | Many-to-many relationship linking courses to instructors | — |
| `modules` | Curriculum sections inside a course | — |
| `lessons` | Video/text lessons with sorting | `wordpress_lesson_id` |
| `enrollments` | Active/completed student registrations | `wordpress_enrollment_id` |
| `lesson_progress` | Per-lesson completion tracking | — |
| `subscriptions` | Stripe subscription state reconciliation | — |

---

## 5. Running Migrations & Seeding

### Option A: Using Supabase CLI (Recommended)
```bash
# Initialize local Supabase instance
supabase start

# Apply migrations
supabase db reset

# Seed demo courses & modules
supabase db execute --file supabase/seed.sql
```

### Option B: Supabase Cloud Dashboard
1. Open your project on [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor**.
3. Copy and run `supabase/migrations/20260831000000_initial_schema.sql`.
4. Copy and run `supabase/seed.sql`.

---

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
# Start development server
npm run dev

# Run TypeScript linter
npm run lint

# Format codebase with Prettier
npm run format

# Production build test
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 10. Deployment to Vercel

1. Push this repository to GitHub/GitLab.
2. Import the project into the [Vercel Dashboard](https://vercel.com).
3. Configure the **Environment Variables** matching `.env.example`.
4. Add the live production webhook URL to Stripe:
   ```
   https://your-domain.vercel.app/api/stripe/webhook
   ```
5. In your Supabase Auth Settings:
   - Add `https://your-domain.vercel.app/api/auth/callback` to **Redirect URLs**.
   - Set Site URL to `https://your-domain.vercel.app`.

---

## 11. LearnDash Migration Strategy

To support the migration from WordPress + LearnDash, all tables include nullable legacy IDs:
- `profiles.wordpress_user_id`
- `courses.wordpress_course_id`
- `lessons.wordpress_lesson_id`
- `enrollments.wordpress_enrollment_id`

### Dedicated Migration Directory
Future ETL (Extract, Transform, Load) scripts should be placed in:
```text
scripts/
└── migration/
    ├── 01_export_wordpress_data.php   # WP-CLI / REST exporter for users, courses, and lessons
    ├── 02_import_users.ts              # Migrates WP users to Supabase Auth & profiles
    ├── 03_import_courses.ts            # Imports course hierarchies, modules, and lessons
    ├── 04_import_enrollments.ts        # Migrates LearnDash user enrollment & completion data
    └── 05_reconcile_stripe.ts          # Matches existing Stripe customers by email metadata
```

Because the database schema already includes foreign key constraints, indexes, and legacy reference columns, migration scripts can be executed safely using the `SUPABASE_SERVICE_ROLE_KEY` via `lib/supabase/admin.ts`.
