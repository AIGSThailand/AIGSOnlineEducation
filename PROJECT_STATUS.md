# AIGS Online Education Platform - Milestone 1 Documentation

**Project Status**: ✅ Milestone 1 Completed & Production-Ready  
**Date**: August 31, 2026  
**Target Architecture**: Next.js 14 App Router + Supabase PostgreSQL (RLS) + Stripe Subscriptions  
**Legacy Target**: WordPress + LearnDash Migration Compatibility

---

## Executive Summary

Milestone 1 establishes the complete production foundation for the **AIGS Online Education Management System**, engineered to replace a legacy WordPress + LearnDash setup.

All primary architectural objectives have been implemented and verified:

- Cookie-based authentication and edge session management via `@supabase/ssr`.
- Strict multi-role authorization (Admin, Instructor, Student) enforced both at the application level and via PostgreSQL Row Level Security (RLS).
- Stripe integration with server-side webhook ingestion supporting subscriptions and automated course enrollment.
- LearnDash migration readiness with preserved legacy foreign keys across all core database entities.
- Clean build compilation and Vercel production deployment compatibility.

---

## 1. Implemented Architecture & Technology Stack

| Layer               | Technology                  | Details / Implementation                                                                                         |
| ------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Framework**       | Next.js 14.2+ (App Router)  | Server Components by default; Client Components (`"use client"`) strictly isolated to interactive UI boundaries. |
| **Language**        | TypeScript 5.7+             | Strict mode enabled (`strict: true`, `noImplicitAny`), explicit types across database queries, no `any` leaks.   |
| **Styling & UI**    | Tailwind CSS + Lucide Icons | Responsive modern layout, role-specific color badges, stat cards, and collapsible sidebars.                      |
| **Database & Auth** | Supabase (PostgreSQL 15+)   | Cookie-based auth with `@supabase/ssr`, RLS policies, automated DB triggers.                                     |
| **Payments**        | Stripe SDK                  | Server-only Stripe client, raw-body webhook signature verification.                                              |
| **Validation**      | Zod 3.24+                   | Schema validation for registration, login, course management, and checkout.                                      |

---

## 2. Directory Structure & Finished Modules

```text
AIGSOnlineEducation/
├── .env.example                          # Documented environment variable template
├── .env.local                            # Local environment configuration
├── .eslintrc.json                        # Clean ESLint configuration extending next/core-web-vitals
├── next.config.mjs                       # Next.js config with remote image patterns
├── package.json                          # Production dependencies & build scripts
├── postcss.config.mjs                    # PostCSS processor configuration
├── tailwind.config.ts                    # Extended design tokens & brand theme
├── tsconfig.json                         # Strict TypeScript path aliases (@/*)
├── README.md                             # Project setup & deployment manual
├── PROJECT_STATUS.md                     # Milestone 1 completion documentation
├── middleware.ts                         # Edge middleware route matcher & session refresh
│
├── app/
│   ├── layout.tsx                        # Root layout
│   ├── page.tsx                          # Public landing page with feature overview
│   ├── not-found.tsx                     # Global 404 page
│   ├── error.tsx                         # Global error boundary
│   ├── loading.tsx                       # Global loading skeleton
│   ├── globals.css                       # Tailwind design tokens and base styles
│   │
│   ├── (auth)/                           # Authentication routes (Shared auth shell)
│   │   ├── layout.tsx                    # Centered authentication layout
│   │   ├── login/page.tsx                # Email + password sign in
│   │   ├── register/page.tsx             # Student & instructor account creation
│   │   ├── forgot-password/page.tsx      # Password recovery email trigger
│   │   ├── reset-password/page.tsx       # New password confirmation
│   │   └── auth-code-error/page.tsx      # Expired/invalid link fallback
│   │
│   ├── admin/                            # Admin Portal (Protected: role = 'admin')
│   │   ├── layout.tsx                    # Admin shell with role verification
│   │   ├── dashboard/page.tsx            # System metrics & migration status
│   │   ├── users/page.tsx                # User account table & role tags
│   │   ├── courses/page.tsx              # Platform courses overview & slugs
│   │   ├── enrollments/page.tsx          # Student enrollments & Stripe links
│   │   └── reports/page.tsx              # Reporting placeholder (Phase 2)
│   │
│   ├── instructor/                       # Instructor Portal (Protected: instructor/admin)
│   │   ├── layout.tsx                    # Instructor dashboard shell
│   │   ├── dashboard/page.tsx            # Teaching overview & assigned stats
│   │   ├── courses/page.tsx              # Instructor-assigned course list
│   │   ├── students/page.tsx             # Enrolled learners across assigned courses
│   │   ├── assignments/page.tsx          # Grading module placeholder (Phase 2)
│   │   └── quizzes/page.tsx              # Quiz manager placeholder (Phase 2)
│   │
│   ├── student/                          # Student Portal (Protected: authenticated)
│   │   ├── layout.tsx                    # Student dashboard shell
│   │   ├── dashboard/page.tsx            # Enrolled courses, lessons finished, stats
│   │   ├── courses/page.tsx              # My Enrolled Courses view
│   │   ├── assignments/page.tsx          # Homework & submissions placeholder
│   │   ├── grades/page.tsx               # Transcripts & progress placeholder
│   │   └── certificates/page.tsx         # Digital credentials placeholder
│   │
│   ├── courses/                          # Public & Enrolled Course Experience
│   │   ├── layout.tsx                    # Header with persistent auth navigation
│   │   ├── page.tsx                      # Public Course Catalog
│   │   └── [courseId]/
│   │       ├── page.tsx                  # Course syllabus & enrollment card
│   │       └── lessons/[lessonId]/
│   │           └── page.tsx              # Video player & lesson content viewer
│   │
│   └── api/
│       ├── auth/callback/route.ts        # PKCE code exchange & role redirect handler
│       └── stripe/webhook/route.ts       # Raw body Stripe webhook ingestion
│
├── components/
│   ├── ui/                               # Atomic reusable UI components
│   │   ├── alert.tsx                     # Info, warning, error, success alerts
│   │   ├── badge.tsx                     # Status tags (published, active, role)
│   │   ├── button.tsx                    # Standard & loading state buttons
│   │   ├── card.tsx                      # Card container, Header, Title, Content
│   │   ├── input.tsx                     # Form inputs with validation errors
│   │   └── label.tsx                     # Accessible form labels with required tags
│   ├── layout/                           # Layout shells and navigation
│   │   ├── dashboard-shell.tsx           # Responsive shell connecting sidebar & header
│   │   ├── header.tsx                    # Sticky header with greeting & user menu
│   │   ├── mobile-nav.tsx                # Mobile hamburger drawer navigation
│   │   ├── sidebar.tsx                   # Role-aware sidebar navigation
│   │   └── user-menu.tsx                 # Profile avatar dropdown & logout action
│   ├── auth/                             # Client form components
│   │   ├── forgot-password-form.tsx      # Password reset request form
│   │   ├── login-form.tsx                # Sign in form with validation
│   │   ├── register-form.tsx             # Registration form with role selection
│   │   └── reset-password-form.tsx       # Password update form
│   ├── courses/                          # Course components
│   │   ├── course-card.tsx               # Course card with thumbnail & status
│   │   └── lesson-sidebar.tsx            # Collapsible course syllabus lesson tree
│   └── dashboard/                        # Dashboard widgets
│       ├── recent-activity.tsx           # Activity feed placeholder
│       └── stat-card.tsx                 # Metric card with icons & trends
│
├── lib/
│   ├── supabase/                         # Supabase SDK instances
│   │   ├── client.ts                     # Browser client (createBrowserClient)
│   │   ├── server.ts                     # Server client with cookie handling
│   │   ├── middleware.ts                 # Edge session update & route guard
│   │   └── admin.ts                      # Service-role admin client (server-only)
│   ├── stripe/                           # Stripe integration
│   │   ├── client.ts                     # Browser Stripe instance loader
│   │   ├── server.ts                     # Server Stripe SDK instance
│   │   ├── sync.ts                       # Customer & subscription sync helpers
│   │   └── webhook-handlers.ts           # Handlers for Stripe lifecycle events
│   ├── auth/                             # Authorization helpers
│   │   ├── actions.ts                    # Server actions (login, signup, logout)
│   │   ├── permissions.ts                # requireAuth, requireRole, canAccessCourse
│   │   └── redirects.ts                  # Role-based dashboard redirect router
│   ├── validations/                      # Zod validation schemas
│   │   ├── auth.ts                       # Login, register, reset password schemas
│   │   ├── course.ts                     # Course and lesson schemas
│   │   └── subscription.ts               # Checkout session schemas
│   └── utils/
│       └── index.ts                      # cn(), formatDate(), getInitials()
│
├── types/
│   ├── database.types.ts                 # Full TypeScript schema for Supabase DB
│   ├── auth.types.ts                     # UserProfile, AuthSessionUser types
│   ├── lms.types.ts                      # CourseWithInstructors, ModuleWithLessons
│   └── stripe.types.ts                   # Stripe subscription & mapping types
│
└── supabase/
    ├── migrations/
    │   └── 20260831000000_initial_schema.sql # Core tables, enums, triggers & RLS
    └── seed.sql                          # Demo courses, modules & lessons
```

---

## 3. Database Schema & Migration Details

The initial database migration (`supabase/migrations/20260831000000_initial_schema.sql`) contains:

### Tables Created & Indexed

| Table                       | Purpose                                                  | RLS Access Policy                                                    | LearnDash Legacy ID       |
| --------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------- |
| `public.profiles`           | User accounts & roles (`admin`, `instructor`, `student`) | Users see self; Instructors see enrolled students; Admins see all    | `wordpress_user_id`       |
| `public.courses`            | Course catalog (draft, published, archived)              | Public reads published; Instructors edit assigned; Admins manage all | `wordpress_course_id`     |
| `public.course_instructors` | Many-to-many relationship linking courses to instructors | Instructors view assigned; Admins manage                             | —                         |
| `public.modules`            | Course chapters/sections                                 | Enrolled students & instructors view; Admins manage                  | —                         |
| `public.lessons`            | Lesson content & video URLs                              | Enrolled students & assigned instructors read; Admins manage         | `wordpress_lesson_id`     |
| `public.enrollments`        | Active, completed, or cancelled student enrollments      | Students view own; Instructors view their courses; Admins manage     | `wordpress_enrollment_id` |
| `public.lesson_progress`    | Per-lesson completion tracking                           | Students manage own progress; Instructors & Admins view              | —                         |
| `public.subscriptions`      | Stripe subscription state reconciliation                 | Users view own; Service-role webhook manages                         | —                         |

### Automated Database Functions & Triggers

1. **`handle_new_user()`**: PostgreSQL `SECURITY DEFINER` trigger executed `AFTER INSERT ON auth.users` that automatically creates a matching row in `public.profiles` with the designated role and metadata.
2. **`set_current_timestamp_updated_at()`**: Automatically maintains `updated_at` timestamps across all tables.
3. **Security Helper Functions**: `current_user_role()`, `is_admin()`, `is_instructor()`, `is_assigned_instructor(course_id)`, and `is_enrolled_in_course(course_id)` to ensure fast, non-recursive RLS policy evaluation.

---

## 4. Authentication & Authorization Flow

```text
User Action            Server Evaluation                       Routing Outcome
──────────────────────────────────────────────────────────────────────────────────
Sign Up             →  Supabase Auth + Trigger Profile       → Role Dashboard / Verify Email
Sign In             →  Server Action (loginAction)           → Role-Aware Redirect
                       • Admin                               → /admin/dashboard
                       • Instructor                          → /instructor/dashboard
                       • Student                             → /student/dashboard
Protected Access    →  middleware.ts + requireRole()         → Authorized or Redirect to /login
Course Access Check →  canAccessCourse(courseId)             → Unlock Lessons or Restrict
```

---

## 5. Stripe Webhook & Payment Reconciliation

- **Endpoint**: `/api/stripe/webhook` (Configured with raw text signature verification via `stripe.webhooks.constructEvent`).
- **Customer Linking**: `getOrCreateStripeCustomer` matches existing Stripe customers by email or metadata (`supabase_user_id`), preserving subscriptions migrated from WordPress/WooCommerce.
- **Handled Events**:
  - `checkout.session.completed`: Resolves user, creates subscription row, and auto-enrolls student into the purchased course.
  - `customer.subscription.created` & `customer.subscription.updated`: Syncs expiration date and status (`active`, `past_due`, `canceled`).
  - `customer.subscription.deleted`: Revokes access or marks subscription inactive.
  - `invoice.paid` / `invoice.payment_failed`: Updates subscription payment logs.

---

## 6. LearnDash Migration Readiness

All database tables are equipped with unique, indexed legacy IDs (`wordpress_*`) to facilitate one-time or phased ETL migration from WordPress MySQL tables:

| LearnDash CPT / Table         | Supabase Destination                            | Strategy                                                                     |
| ----------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `wp_users` + `wp_usermeta`    | `public.profiles`                               | Migrates credentials into `auth.users` and maps `ID` to `wordpress_user_id`. |
| `sfwd-courses`                | `public.courses`                                | Maps course post content, slug, and status with `wordpress_course_id`.       |
| `sfwd-lessons`                | `public.modules`                                | Maps chapter modules and sort orders.                                        |
| `sfwd-topic` / `sfwd-lessons` | `public.lessons`                                | Ingests video URLs and HTML content with `wordpress_lesson_id`.              |
| `_sfwd-course_progress`       | `public.enrollments` & `public.lesson_progress` | Expands serialized PHP user progress into relational rows.                   |

_Future migration scripts will reside in `scripts/migration/` and execute with the `SUPABASE_SERVICE_ROLE_KEY` via `lib/supabase/admin.ts`._

---

## 7. Next Milestone Roadmap (Phase 2)

1. **Quiz & Assessment Engine**:
   - Multiple choice, single choice, true/false, and open essay question types.
   - Timed quiz attempts and automated grading logic.
2. **Assignment Submissions & File Storage**:
   - Supabase Storage buckets for student project uploads.
   - Instructor review, feedback, and gradebook scoring.
3. **Automated Certificate Generation**:
   - Dynamic PDF certificate generation upon 100% course completion.
4. **LearnDash Batch Ingestion Tooling**:
   - CLI/REST migration script to import historical courses, users, and progress from WordPress.
