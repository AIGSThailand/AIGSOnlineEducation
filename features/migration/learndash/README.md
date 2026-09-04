# LearnDash REST adapter

Live LearnDash LMS REST API v2/v1 client + course/question migration into Supabase.

## Phases

| Phase | Status | Scope |
|-------|--------|--------|
| 1 | Done | Read-only inspect (course + steps + entities) |
| 2 | Done | Mapping policy, transform, dry-run / write migrate |
| 3 | Done | Quiz questions + answer options (ProQuiz via v1) |
| 4+ | Not started | Users, progress, Stripe |

## Does not (yet)

- Mutate WordPress / LearnDash (GET only)
- Import users / enrollments / progress / Stripe

## Entry points

| Path | Role |
|------|------|
| `lib/learndash/` | Config, client, pagination, step parser, API |
| `features/migration/learndash/inspect-course.ts` | `inspectLearnDashCourse()` |
| `features/migration/learndash/transform-curriculum.ts` | Pure AIGS curriculum proposal |
| `features/migration/learndash/transform-questions.ts` | Pure question/option proposal |
| `features/migration/learndash/migrate-course.ts` | Dry-run + idempotent course write |
| `features/migration/learndash/migrate-questions.ts` | Dry-run + idempotent question write |
| `scripts/migrate-learndash-course.ts` | Migrate CLI |

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

## Env

```ini
LEARNDASH_BASE_URL=https://your-wordpress-site.example
LEARNDASH_USERNAME=wp-username
LEARNDASH_APP_PASSWORD=xxxx xxxx xxxx xxxx

# For --write:
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# ALLOW_LEARNDASH_MIGRATE_PRODUCTION=true
```

## Commands

```bash
npm run test:learndash-parse
npm run test:learndash-transform
npm run test:learndash-questions

npm run inspect:learndash-course -- 26475

# Single course
npm run migrate:learndash-course -- 26475 --dry-run --with-questions
npm run migrate:learndash-course -- 26475 --write --with-questions

# All published courses
npm run migrate:learndash-courses -- --dry-run
npm run migrate:learndash-courses -- --write --with-questions
npm run migrate:learndash-courses -- --write --with-questions --after 26475
```

## Relation to `.ld` importer

`scripts/migrate-learndash.mjs` / `migrate-learndash-quizzes.mjs` import from export packages.  
This adapter uses the **live REST API** and can load MCQ options that `.ld` often omits.
