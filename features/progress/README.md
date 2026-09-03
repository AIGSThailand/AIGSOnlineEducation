# Progress domain

Student completion tracking across the course tree.

## Tables

- `lesson_progress` (Phase 1 — retained)
- `topic_progress` (Phase 2)
- `step_progress` (Phase 2 — canonical for course_steps)

## Strategy

Write to `step_progress` for new features; keep `lesson_progress` in sync during transition.
