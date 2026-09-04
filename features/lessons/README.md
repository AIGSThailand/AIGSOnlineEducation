# Lessons domain

Lesson content authoring, media metadata, resources, and learning settings.

## Storage model

| Column | Role |
| --- | --- |
| `lessons.content` | Editable / rendered HTML (`content_html`) |
| `lessons.content_json` | TipTap JSON after structured edits |
| `lessons.source_content_html` | Immutable imported LearnDash HTML (audit/recovery) |

Normal editor saves update `content` + `content_json` only. They never write `source_content_html`.

## Course Builder (Phase 1)

- UI: `components/courses/builder/lesson-editor.tsx` + `components/courses/builder/lesson/*`
- Actions: `features/lessons/actions.ts`
- Validation: `features/lessons/schema.ts`
- Migration: `supabase/migrations/20260904120000_lesson_editor_phase1.sql`

## Resources

Table `lesson_resources` with explicit `position` ordering.

## Deferred

- Runtime drip / completion engine
- Lesson revision history
- Full education block extensions
- Student interactive media transcripts UI
