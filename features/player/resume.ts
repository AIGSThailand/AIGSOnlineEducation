import { lockedStepKeys } from "./build-player";
import type { CoursePlayerData } from "./types";

export function getLearningResume(player: CoursePlayerData) {
  const completed = new Set(player.completedKeys);
  const locked = lockedStepKeys(
    player.flatSteps,
    completed,
    player.progressionType === "linear",
    false
  );
  const done = player.flatSteps.filter((step) => completed.has(step.key)).length;
  const next = player.flatSteps.find((step) => !completed.has(step.key) && !locked.has(step.key));
  return {
    next: next || player.flatSteps[0] || null,
    completed: done,
    total: player.flatSteps.length,
    percent: player.flatSteps.length ? Math.round((done / player.flatSteps.length) * 100) : 0,
    finished: player.flatSteps.length > 0 && done === player.flatSteps.length,
  };
}
