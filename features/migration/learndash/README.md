# LearnDash REST adapter

Live LearnDash LMS REST API v2/v1 client + course/question migration into Supabase.

## Phases

| Phase | Status | Scope |
|-------|--------|--------|
| 1 | Done | Read-only inspect (course + steps + entities) |
| 2 | Done | Mapping policy, transform, dry-run / write migrate |
| 3 | Done | Quiz questions + answer options (ProQuiz via v1) |
| 4a | Done (inspect/dry-run) | Course users + enrollment proposals |
| 4b | Done | Auth + enrollments for **enrolled users only** |
| 5a | Done | Progress (enrolled users → lesson/step progress) |
| 5b | Done | Groups + members/leaders/courses + materialize enrollments |
| 6+ | Not started | Certificates, Stripe linkage |

## Does not (yet)

- Mutate WordPress / LearnDash (GET only)
- Import the full WP user directory for course enrollments (only **enrolled** users; group members are created when needed)
- Import quiz attempt answers / certificates / Stripe

## Entry points

| Path | Role |
|------|------|
| `lib/learndash/` | Config, client, pagination, step parser, API |
| `features/migration/learndash/inspect-course.ts` | `inspectLearnDashCourse()` |
| `features/migration/learndash/inspect-users-enrollments.ts` | `inspectLearnDashUsersEnrollments()` |
| `features/migration/learndash/transform-curriculum.ts` | Pure AIGS curriculum proposal |
| `features/migration/learndash/transform-questions.ts` | Pure question/option proposal |
| `features/migration/learndash/transform-users-enrollments.ts` | Pure user + enrollment proposal |
| `features/migration/learndash/migrate-users.ts` | Dry-run + Auth/enrollment write (enrolled only) |
| `scripts/migrate-learndash-course.ts` | Migrate CLI |
| `scripts/inspect-learndash-users.ts` | Users/enrollments inspect CLI |
| `scripts/migrate-learndash-users.ts` | Users/enrollments migrate CLI |

## Mapping policy (curriculum)

| Policy | When | Mapping |
|--------|------|---------|
| `flat-lessons` (auto if topics=0) | Course 26475 shape | LD Lesson → AIGS lesson; quizzes → quiz steps |
| `topics-as-lessons` (auto if topics>0) | Classic LD tree | LD Lesson → section; LD Topic → lesson |

## Questions (Phase 3)

LearnDash v2 `sfwd-question` lists questions per quiz, but `answers` is **null** on this site.  
Answer options come from **v1** `GET /wp-json/ldlms/v1/sfwd-questions/{id}` → `_answerData`.

**Gotcha:** do not pass `context=edit` on the v2 question collection — it breaks the `quiz` filter and returns the whole bank.
Writes: `questions` (by `wordpress_question_id`), replace `question_options`, rebuild `quiz_questions`, upsert `wordpress_migration_map` (`sfwd-question`).

## Users + enrollments (Phase 4)

- **Enrollment IDs:** prefer `GET /ldlms/v1/sfwd-courses/{id}/users` (returns user id strings).  
  v2 `…/users` on this site is **unfiltered** (~all WP users) — detected via `X-WP-Total` vs site user total and skipped.
- **Hydrate:** `GET /wp/v2/users/{id}?context=edit` for email + roles (Application Password).
- **Writes (4b):** only users enrolled in selected course(s) (~135 for `--all`, not ~14k site users).
  - Auth: `email_confirm=true` + random password (reset to sign in)
  - Link existing profiles by `wordpress_user_id` or email
  - Upsert `enrollments` with `enrollment_source=migration`
  - Requires courses already migrated (`courses.wordpress_course_id`)

## Progress (Phase 5a)

- Header: `GET /ldlms/v2/users/{id}/course-progress/{courseId}`
- Steps: `GET …/course-progress/{courseId}/steps` — this site returns a **nested** `[[step,…]]` array; flatten before use.
- Completed = `step_status === "completed"` only.
- Writes: `lesson_progress` + `step_progress`; topics → `topic_progress` + step; quizzes → `step_progress` only.
- Marks `enrollments.status=completed` when LD header says completed (does not invent enrollments).

## Groups (Phase 5b)

- `GET /ldlms/v2/groups`; members prefer **v1** `…/groups/{id}/users` (id strings).
- Writes: `groups`, `group_users`, `group_leaders`, `group_courses`.
- Materialize enrollments with `enrollment_source=group`; **never overwrite** existing `stripe` / `migration` / `admin` / `group` rows (only upgrade weak `manual`).
- Auth-create missing group members/leaders (same password strategy as Phase 4).

## Env

```ini
# In .env.local / .env.staging / .env.production:
LEARNDASH_BASE_URL=https://your-wordpress-site.example
LEARNDASH_USERNAME=wp-username
LEARNDASH_APP_PASSWORD=xxxx xxxx xxxx xxxx

NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Only for intentional production Supabase writes:
# ALLOW_LEARNDASH_MIGRATE_PRODUCTION=true
```

```bash
npm run migrate:learndash-courses -- --env staging --write --with-questions
```

Use a WordPress **Application Password**. Never commit credentials.

## Commands

```bash
npm run test:learndash-parse
npm run test:learndash-transform
npm run test:learndash-questions

npm run inspect:learndash-course -- 26475

# Single course
npm run migrate:learndash-course -- 26475 --dry-run --with-questions
npm run migrate:learndash-course -- 26475 --env staging --write --with-questions

# All published courses
npm run migrate:learndash-courses -- --dry-run
npm run migrate:learndash-courses -- --env staging --write --with-questions
npm run migrate:learndash-courses -- --write --with-questions --after 26475

# Phase 4 — users + enrollments (enrolled users only)
npm run inspect:learndash-users -- 26475
npm run inspect:learndash-users -- --all
npm run migrate:learndash-users -- --all --dry-run
npm run migrate:learndash-users -- 26475 --write
npm run migrate:learndash-users -- --all --env staging --write

# Phase 5 — progress (enrolled users) + groups
npm run inspect:learndash-progress -- 26475
npm run migrate:learndash-progress -- 26475 --write
npm run migrate:learndash-progress -- --all --dry-run
npm run inspect:learndash-groups
npm run migrate:learndash-groups -- --dry-run
npm run migrate:learndash-groups -- --write
```

## Relation to `.ld` importer

`scripts/migrate-learndash.mjs` / `migrate-learndash-quizzes.mjs` import from export packages.  
This adapter uses the **live REST API** and can load MCQ options that `.ld` often omits.
