# LearnDash → Supabase Migration Mapping

## Source systems

| System                  | Role                                            |
| ----------------------- | ----------------------------------------------- |
| WordPress + LearnDash   | Historical LMS content, users, progress, groups |
| Stripe                  | Payments (one-time and legacy subscriptions)    |
| AIGS Next.js + Supabase | Target platform                                 |

---

## Content mapping table

| LearnDash source     | Export / WP location                   | Supabase target         | Legacy column                     |
| -------------------- | -------------------------------------- | ----------------------- | --------------------------------- |
| Course               | `sfwd-courses` / `post_type_course.ld` | `courses`               | `wordpress_course_id`             |
| Section heading      | `course_sections` meta JSON            | `course_sections`       | `wordpress_section_id` (nullable) |
| Lesson               | `sfwd-lessons` / `post_type_lesson.ld` | `lessons`               | `wordpress_lesson_id`             |
| Topic                | `sfwd-topic`                           | `topics`                | `wordpress_topic_id`              |
| Course builder tree  | `ld_course_steps` meta                 | `course_steps`          | —                                 |
| Quiz                 | `sfwd-quiz` + ProQuiz tables           | `quizzes`               | `wordpress_quiz_id`               |
| Question             | `sfwd-question` + ProQuiz              | `questions`             | `wordpress_question_id`           |
| Quiz ↔ Question      | ProQuiz mapping                        | `quiz_questions`        | —                                 |
| Answer options       | ProQuiz answers                        | `question_options`      | —                                 |
| Quiz attempt         | ProQuiz stat / LD activity             | `quiz_attempts`         | `wordpress_attempt_ref`           |
| Attempt answers      | ProQuiz response tables                | `quiz_attempt_answers`  | —                                 |
| Certificate template | `sfwd-certificates`                    | `certificate_templates` | `wordpress_certificate_id`        |
| Certificate rule     | LD associations                        | `certificate_rules`     | —                                 |
| Earned certificate   | LD user certificates                   | `earned_certificates`   | metadata JSON                     |
| Group                | `groups` CPT                           | `groups`                | `wordpress_group_id`              |
| Group member         | LD group users                         | `group_users`           | —                                 |
| Group leader         | LD group leaders                       | `group_leaders`         | —                                 |
| Group course         | LD group courses                       | `group_courses`         | —                                 |

---

## User mapping

| LearnDash / WordPress | Supabase                                                     |
| --------------------- | ------------------------------------------------------------ |
| `wp_users.ID`         | `profiles.wordpress_user_id`                                 |
| Email, name           | `auth.users` + `profiles`                                    |
| Global WP role        | **Not** mapped 1:1 to app role; default `student`            |
| Group leader          | `group_leaders` (not global `group_leader` role)             |
| Instructor (business) | `course_instructors` + optional `profiles.role = instructor` |

---

## Enrollment mapping

| Source                       | `enrollment_source` | `source_reference`    | Other fields               |
| ---------------------------- | ------------------- | --------------------- | -------------------------- |
| Manual admin grant           | `admin` or `manual` | admin user id / note  | —                          |
| Stripe one-time checkout     | `stripe`            | `checkout_session_id` | `stripe_payment_intent_id` |
| Stripe subscription (legacy) | `stripe`            | `subscription_id`     | `stripe_subscription_id`   |
| LearnDash group membership   | `group`             | `groups.id`           | Materialized enrollment    |
| ETL import                   | `migration`         | import batch id       | `wordpress_enrollment_id`  |

**Unique constraint preserved:** `(student_id, course_id)` — one enrollment row per student per course regardless of source.

---

## Phase 2 backfill (existing Phase 1 data)

Applied automatically in migration `20260901000000_phase2_learndash_schema.sql`:

```text
modules  ──copy (same UUID)──►  course_sections
lessons  ──derive steps──────►  course_steps (step_type = lesson)
```

Existing `lesson_progress` rows remain valid (still reference `lessons.id`).

---

## Importer phases (future — not in scope)

### Phase A — Content

1. Upsert courses
2. Insert course_sections from `course_sections` JSON
3. Upsert lessons, topics, quizzes (by wordpress IDs)
4. Build `course_steps` from `ld_course_steps` tree

### Phase B — Assessments

1. Import questions + options
2. Link quiz_questions
3. Import attempts + answers (optional historical)

**Script:** `npm run migrate:learndash:quizzes` reads `learndash_data/*question-quiz*/`.

**Known export limitation:** LearnDash `.ld` exports include question **text and type** but not MCQ answer options for most questions (~1,800+). Options live in ProQuiz DB tables (`wp_learndash_pro_quiz_answer`). Prefer the REST migrator (`npm run migrate:learndash-course -- … --with-questions`), which loads `_answerData` from `GET /ldlms/v1/sfwd-questions/{id}`. A direct MySQL / ProQuiz export remains a fallback if REST is unavailable.

### Phase C — Users & access

1. Import users → Supabase Auth + profiles
2. Import enrollments with `enrollment_source = 'migration'`
3. Import groups, leaders, members, group_courses
4. Materialize group enrollments

### Phase D — Reconciliation

1. Compare counts vs LearnDash
2. Spot-check course trees and video URLs
3. Validate Stripe customer linkage

---

## Shared step handling (importer algorithm)

```text
FOR each LearnDash lesson post ID:
  UPSERT lessons BY wordpress_lesson_id

FOR each course using that lesson in ld_course_steps:
  INSERT course_steps (
    course_id,
    step_type = 'lesson',
    lesson_id,
    section_id,      -- resolved from course_sections order
    parent_step_id,  -- NULL for top-level lesson
    sort_order
  )
```

Repeat for topics (parent = lesson step) and quizzes (parent = lesson or topic step, or NULL for final quiz).

---

## Rollback considerations

| Action                         | Safe?                                       |
| ------------------------------ | ------------------------------------------- |
| Drop Phase 2 tables only       | Yes — Phase 1 tables untouched              |
| Remove `course_steps` backfill | Yes — re-runnable INSERT                    |
| Drop `modules`                 | **No** — Phase 1 UI still references it     |
| Remove `wordpress_*` columns   | **No** — until reconciliation window closes |

---

## Breaking changes (application)

| Change                                 | Impact                             | Required app update                     |
| -------------------------------------- | ---------------------------------- | --------------------------------------- |
| New tables                             | None until queried                 | Gradual adoption                        |
| `course_sections` duplicates `modules` | Read from either during transition | Prefer `course_steps` tree              |
| `lessons.course_id` deprecated         | Still populated                    | Move syllabus queries to `course_steps` |
| `enrollment_source` new column         | Default `manual`                   | Stripe webhook should set `stripe`      |
| Group access                           | Not auto-enrolled until sync       | Implement group enrollment sync job     |

See `docs/phase-2-schema.md` for RLS and integrity details.
