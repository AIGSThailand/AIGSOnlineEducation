import type { PlayerStep } from "@/features/player/types";

type StepRef = Pick<PlayerStep, "stepId" | "kind" | "contentId">;

/**
 * Same rule as the course player: a course step row wins when it exists.
 * Lesson progress is used only when that step has no step_progress row.
 */
export function isPlayerStepComplete(
  step: StepRef,
  stepProgress: Map<string, boolean>,
  lessonProgress: Map<string, boolean>
): boolean {
  if (step.stepId && stepProgress.has(step.stepId)) {
    return stepProgress.get(step.stepId) === true;
  }
  if (step.kind === "lesson") {
    return lessonProgress.get(step.contentId) === true;
  }
  return false;
}
