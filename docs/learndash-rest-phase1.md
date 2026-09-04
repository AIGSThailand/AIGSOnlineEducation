# LearnDash REST migration — Phase 1–3 notes

## Architecture findings

| Area | Finding |
|------|---------|
| Layout | No `src/` — use `lib/`, `features/`, `scripts/` |
| Curriculum tables | Use `course_steps` (not a new `course_items` table) |
| Mapping table | Prefer existing `wordpress_migration_map` |
| Existing importer | `scripts/migrate-learndash.mjs` from `.ld` exports |
| Auth env | `LEARNDASH_*` vars (Application Password) |
| Question answers | v2 `answers` null; use v1 `sfwd-questions/{id}` `_answerData` |

## Phase 1 delivered

- Read-only LearnDash REST v2 client (`lib/learndash/`)
- Course + Course Steps + Lesson/Topic/Quiz fetch
- `inspectLearnDashCourse(courseId)` — no Supabase writes
- CLI: `npm run inspect:learndash-course -- <id>`

## Phase 2 delivered

- Auto mapping policy: `flat-lessons` / `topics-as-lessons`
- Dry-run + `--write` via `migrateLearnDashCourse()`
- Idempotent upserts + env safety

## Phase 3 delivered

- List questions: `GET /ldlms/v2/sfwd-question?quiz=`
- Options: `GET /ldlms/v1/sfwd-questions/{id}` (`_answerData`)
- Transform → `questions` / `question_options` / `quiz_questions`
- CLI flag: `--with-questions`
- Offline test: `npm run test:learndash-questions`

Validated: quiz **26556** returns 8 questions with ProQuiz options via v1.  
Course **26475** dry-run `--with-questions`: 77 questions across 8 quizzes, **0 missing options**.

## Not started (Phase 4+)

- Users, enrollments, progress
- Stripe
- Admin UI
