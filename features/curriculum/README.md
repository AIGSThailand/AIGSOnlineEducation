# Curriculum domain (Course Builder Phase 1)

## Database mapping

| Spec concept | This project |
|--------------|--------------|
| `course_sections` | Sections (LearnDash section headings) |
| `course_items` | **`course_steps`** — ordered curriculum layer |
| `lessons` / `quizzes` | Content tables referenced by `course_steps` |
| `modules` | Legacy Phase 1 mirror (same UUID as `course_sections`) |

Do **not** duplicate `course_items` as a separate table — extend `course_step_type` in a later migration when adding assignment/exam types.

## Query entry point

- `getCourseBuilderData()` / `getCourseBuilder()` in `features/courses/queries.ts`
- Structure assembly: `features/curriculum/build-structure.ts`

## Selection URL

Deep-link builder selection:

```text
/admin/courses/[courseId]/edit?type=lesson&id=<uuid>&sectionId=<uuid>
```

Types: `course`, `section`, `lesson`, `quiz`, `exam`
