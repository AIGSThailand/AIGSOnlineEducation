# Student player

LearnDash-style lesson player: nested syllabus, step progress, prev/next, mark complete.

- Query: `getCoursePlayerData()` in `queries.ts`
- Tree: `build-player.ts` from `course_sections` + `course_steps` (nested quizzes via `parent_step_id`)
- Progress: `features/progress/actions.ts`
- UI: `components/player/`
