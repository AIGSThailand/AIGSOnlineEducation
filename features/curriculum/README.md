# Curriculum domain (Course Builder Phase 1)

## Database mapping

| Spec concept          | This project                                           |
| --------------------- | ------------------------------------------------------ |
| `course_sections`     | Sections (LearnDash section headings)                  |
| `course_items`        | **`course_steps`** — ordered curriculum layer          |
| `lessons` / `quizzes` | Content tables referenced by `course_steps`            |
| `modules`             | Legacy Phase 1 mirror (same UUID as `course_sections`) |

Do **not** duplicate `course_items` as a separate table — extend `course_step_type` in a later migration when adding assignment/exam types.

## Query entry point

- `getCourseBuilderData()` / `getCourseBuilder()` in `features/courses/queries.ts`
- Structure assembly: `features/curriculum/build-structure.ts`
- Student player: `getCoursePlayerData()` in `features/player/queries.ts`

## Selection URL

Deep-link builder selection:

```text
/admin/courses/[courseId]/edit?type=lesson&id=<uuid>&sectionId=<uuid>
```

Types: `course`, `section`, `lesson`, `quiz`, `exam`

## Phase 2 (curriculum interactions)

- **Drag-and-drop** via `@dnd-kit` — reorder sections, lessons, and quizzes; move items between sections
- **Add** section, lesson, or quiz (empty draft quiz opens Quiz editor)
- **Duplicate** section, lesson, or quiz (deep copy for quizzes includes questions/options)
- **Persist order** — `reorderSectionsAction`, `reorderCurriculumAction` dual-write `modules`/`course_sections` and `course_steps`
- Keyboard **move up/down** controls remain as accessible alternatives

Server actions: `features/courses/builder/actions.ts`  
Order persistence: `features/courses/builder/persist-order.ts`  
DnD state helpers: `features/curriculum/dnd-state.ts`

## Phase 3 (lesson editor)

- **TipTap** rich text (`components/courses/builder/rich-text-editor.tsx`) — headings, bold/italic/underline, lists, link, image URL, blockquote, code, HR, undo/redo
- **HTML source** toggle for migrated LearnDash markup TipTap may not fully represent
- **Autosave** (~1.2s debounce) for lesson fields + content; explicit Save still available
- **Lesson settings** — video URL, excerpt, status; LearnDash ID read-only when present

## Phase 4 (course settings)

- Collapsible settings: Publishing, Access, Progression, Media, Instructors, Commerce, Migration
- `courses.access_type` (`open` | `enrollment_required` | `paid` | `private`)
- `courses.promotional_video_url`
- Multi-instructor assignment (admin)
- Autosave for settings; Stripe mapping remains explicit Save (admin only)
- Migration metadata read-only

Migration: `supabase/migrations/20260903120000_course_builder_phase4_settings.sql`

## Phase 5 (quiz editor)

- Quiz settings editor with autosave (title, slug, description, status, passing %, time limit, attempts, flags)
- Question list: add/edit/reorder/remove for `single_choice`, `multiple_choice`, `true_false`
- Server actions in `features/quizzes/actions.ts`
- Student quiz player still deferred

## Lesson editor (Phase 1)

- TipTap content + `content` / `content_json` / immutable `source_content_html`
- Media metadata, resources (`lesson_resources`), learning/drip fields (schema + editor)
- See `features/lessons/README.md`

## Media (S3)

- Presigned uploads: `POST /api/media/presign` (requires `canManageCourse`)
- TipTap lesson images + course thumbnail uploader
- Docs: `docs/media-s3.md`
