import assert from "node:assert/strict";
import { isPlayerStepComplete } from "../features/progress/completion";

const lessonDone = new Map([["lesson-1", true]]);
const stepIncomplete = new Map([["step-1", false]]);

assert.equal(
  isPlayerStepComplete(
    { stepId: "step-1", kind: "lesson", contentId: "lesson-1" },
    stepIncomplete,
    lessonDone
  ),
  false
);
assert.equal(
  isPlayerStepComplete(
    { stepId: null, kind: "lesson", contentId: "lesson-1" },
    stepIncomplete,
    lessonDone
  ),
  true
);
assert.equal(
  isPlayerStepComplete(
    { stepId: "step-2", kind: "quiz", contentId: "quiz-1" },
    new Map([["step-2", true]]),
    lessonDone
  ),
  true
);
assert.equal(
  isPlayerStepComplete(
    { stepId: "step-3", kind: "quiz", contentId: "quiz-1" },
    new Map(),
    lessonDone
  ),
  false
);

console.log("progress completion checks passed");
