# LearnDash Data Model → AIGS Supabase Target Model

## LearnDash hierarchy (WordPress)

LearnDash stores content as WordPress custom post types (CPTs) and builds course structure separately.

```text
sfwd-courses          → Course metadata + settings
sfwd-lessons          → Lesson content (CPT, reusable via course builder)
sfwd-topic            → Topic content (child of lesson in builder)
sfwd-quiz             → Quiz content (can attach to course, lesson, or topic)
sfwd-question         → Question bank entries
sfwd-certificates     → Certificate templates
groups (CPT)          → Organization / cohort containers
```

Course structure is stored in post meta:

- `course_sections` — JSON array of section headings (`type: section-heading`)
- `ld_course_steps` — nested tree: lessons → topics → quizzes

Example from exported data:

```json
{
  "course_sections": [
    { "order": 1, "post_title": "第一课", "type": "section-heading" }
  ],
  "ld_course_steps": {
    "steps": {
      "h": {
        "sfwd-lessons": {
          "76824": { "sfwd-topic": [], "sfwd-quiz": [] }
        }
      }
    }
  }
}
```

---

## Entity mapping

### Courses

| LearnDash | WordPress storage | Supabase |
|-----------|-------------------|----------|
| Course | `sfwd-courses` post | `courses` |
| Title, content, slug, status | `wp_post.*` | `title`, `description`, `slug`, `status` |
| Featured image | `_thumbnail_id` → attachment | `thumbnail_url` |
| Progression | `_sfwd-courses` meta | `progression_type` (`linear` / `free_form`) |
| Price / product | WooCommerce / LD meta | `stripe_product_id`, `stripe_price_id` |
| Legacy ID | post `ID` | `wordpress_course_id` |

### Sections

| LearnDash | Supabase |
|-----------|----------|
| Section heading in course builder | `course_sections` |
| Section title | `title` |
| Order | `sort_order` |
| Legacy ID | Often synthetic (`ID` in JSON) → nullable `wordpress_section_id` |

**Important:** Sections are **not** lessons. Phase 1 incorrectly imported sections into `modules` and attached lessons to them as if modules were chapters.

### Lessons

| LearnDash | Supabase |
|-----------|----------|
| Lesson CPT | `lessons` (content only) |
| Video URL | post content / `_sfwd-lessons` meta | `video_url` + `content` |
| Placement in course | `ld_course_steps` | `course_steps` (`step_type = 'lesson'`) |
| Legacy ID | post `ID` | `wordpress_lesson_id` |

### Topics

| LearnDash | Supabase |
|-----------|----------|
| Topic CPT | `topics` |
| Parent lesson | builder tree | `course_steps.parent_step_id` → parent lesson step |
| Legacy ID | post `ID` | `wordpress_topic_id` |

### Quizzes & questions

| LearnDash | Supabase |
|-----------|----------|
| Quiz CPT | `quizzes` |
| ProQuiz tables (`wp_learndash_pro_quiz_*`) | `questions`, `question_options`, `quiz_questions` |
| Attempts | user activity / ProQuiz stat tables | `quiz_attempts`, `quiz_attempt_answers` |
| Placement | course builder | `course_steps` (`step_type = 'quiz'`) |

### Certificates

| LearnDash | Supabase |
|-----------|----------|
| Certificate CPT | `certificate_templates` |
| Linked to course/quiz/group | meta associations | `certificate_rules` |
| User earned record | user meta / LD certificates | `earned_certificates` |

### Groups

| LearnDash | Supabase |
|-----------|----------|
| Group CPT | `groups` |
| Group users | usermeta / LD tables | `group_users` |
| Group leaders | LD leader meta | `group_leaders` |
| Group courses | LD group-course meta | `group_courses` |

**Do not** store `group_id` on `profiles`. Leadership and membership are relationship tables.

---

## Shared / reusable course steps

LearnDash can reference the same lesson CPT in multiple courses via the course builder.

**Target design:**

1. Import lesson **once** into `lessons` (keyed by `wordpress_lesson_id`).
2. For each course that uses the lesson, insert a **`course_steps`** row pointing at the same `lesson_id`.
3. Sort order and parent differ per `course_steps` row.

This avoids duplicate content and matches LearnDash semantics.

---

## Progress & completion

| LearnDash activity | Supabase (Phase 2) |
|--------------------|-------------------|
| Lesson complete | `lesson_progress` (legacy) + `step_progress` |
| Topic complete | `topic_progress` + `step_progress` |
| Quiz passed | `quiz_attempts.passed` + `step_progress` |
| Course complete | `enrollments.status = 'completed'` + certificate rules |

---

## User & enrollment mapping

| LearnDash | Supabase |
|-----------|----------|
| WordPress user | `auth.users` + `profiles` |
| Course access | `enrollments` |
| Group-granted access | `group_users` + `group_courses` → materialized `enrollments` (`enrollment_source = 'group'`) |
| WooCommerce / Stripe purchase | `enrollments` (`enrollment_source = 'stripe'`) |
| Manual / admin grant | `enrollments` (`enrollment_source = 'manual'` or `'admin'`) |
| Historical import | `enrollments` (`enrollment_source = 'migration'`) |

---

## Stripe coexistence

- **One-time course purchases:** `stripe_payment_intent_id` / `stripe_checkout_session_id` on enrollment.
- **Legacy subscriptions:** `subscriptions` table unchanged; existing customers linked by email / metadata.
- **Product mapping:** optional `courses.stripe_product_id` and `courses.stripe_price_id` for checkout UI.

Group access and Stripe access must remain distinguishable via `enrollment_source`.

---

## Phase 1 migration script note

`scripts/migrate-learndash.mjs` currently:

- Maps LearnDash sections → `modules` (incorrect semantic)
- Embeds `course_id` + `module_id` on each `lesson` (prevents sharing)

Phase 2 schema is ready for a **rewritten importer** that writes `course_sections`, content tables, and `course_steps` correctly. Do not run destructive cleanup until reconciliation is complete.
