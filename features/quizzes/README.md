# Quizzes domain

Quiz definitions, attempts, and grading.

## Tables

- `quizzes`
- `questions`
- `question_options`
- `quiz_questions`
- `quiz_attempts`
- `quiz_attempt_answers`

## Placement

Quizzes attach to courses through `course_steps` (`step_type = 'quiz'`).

## Course Builder

- Editor: `components/courses/builder/quiz-editor.tsx`
- Actions: `features/quizzes/actions.ts`
- Schema: `features/quizzes/schema.ts`
- Add quiz from curriculum tree via `createQuizAction`

Supported authoring types: `single_choice`, `multiple_choice`, `true_false` (essay / fill_blank / assessment limited edit UX).

## Student quiz player

- UI: `components/player/quiz-player.tsx`
- Route: `app/courses/[courseId]/quizzes/[quizId]/page.tsx`
- Actions: `features/quizzes/player-actions.ts` (`getQuizForPlay`, `startQuizAttemptAction`, `submitQuizAttemptAction`)

Behavior:

- Start / resume in-progress attempt
- Auto-grade choice questions; essay-like types marked `needs_review`
- Correct answers are not sent to the client until after submit
- Passing an attempt marks `step_progress` complete
- Respects `max_attempts`, `require_all_questions`, optional time limit display
