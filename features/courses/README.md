# Courses domain

Course catalog, sections, and course builder (`course_steps`).

## Tables

- `courses`
- `course_sections`
- `course_steps`
- `course_instructors`

## Responsibilities (Phase 3+)

- Load published course tree via `course_steps`
- Resolve section headings from `course_sections`
- Map Stripe `stripe_product_id` / `stripe_price_id` for checkout

## Phase 1 compat

- Legacy queries against `modules` + `lessons.course_id` still work until UI migrates.
