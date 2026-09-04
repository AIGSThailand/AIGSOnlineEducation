/**
 * Phase 1 lesson editor validation + source HTML immutability guarantees.
 * Run: npx tsx scripts/test-lesson-editor-schema.ts
 */
import assert from "node:assert/strict";
import {
  createLessonResourceSchema,
  updateLessonContentSchema,
} from "../features/lessons/schema";

function expectFail(label: string, input: unknown) {
  const result = updateLessonContentSchema.safeParse(input);
  assert.equal(result.success, false, `${label} should fail validation`);
}

function expectPass(label: string, input: unknown) {
  const result = updateLessonContentSchema.safeParse(input);
  assert.equal(result.success, true, `${label}: ${result.success ? "" : result.error.message}`);
}

const base = {
  courseId: "11111111-1111-1111-1111-111111111111",
  lessonId: "22222222-2222-2222-2222-222222222222",
  title: "Color Grading",
  slug: "color-grading",
};

expectPass("minimal valid lesson", {
  ...base,
  contentHtml: "<p>Hello</p>",
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
});

expectFail("invalid slug", { ...base, slug: "Bad Slug" });
expectFail("invalid video provider", { ...base, videoProvider: "zoom" });
expectFail("negative duration", { ...base, estimatedDurationMinutes: -1 });
expectFail("bad completion type", { ...base, completionType: "click_done" });

expectPass("media + learning fields", {
  ...base,
  videoProvider: "vimeo",
  videoUrl: "https://vimeo.com/123",
  estimatedDurationMinutes: 12,
  completionType: "video_watch",
  completionSettings: { videoWatchPercentage: 90 },
  dripType: "days_after_enrollment",
  dripValue: { days: 3 },
  status: "draft",
});

const resource = createLessonResourceSchema.safeParse({
  courseId: base.courseId,
  lessonId: base.lessonId,
  title: "Workbook.pdf",
  resourceType: "pdf",
  url: "https://example.com/workbook.pdf",
});
assert.equal(resource.success, true, "resource create should pass");

// Immutability contract: schema must not accept source_content_html as an updatable field.
const withSource = updateLessonContentSchema.safeParse({
  ...base,
  sourceContentHtml: "<p>should be ignored by schema</p>",
});
assert.equal(withSource.success, true, "extra keys are stripped by Zod object schemas");
if (withSource.success) {
  assert.equal(
    "sourceContentHtml" in withSource.data,
    false,
    "parsed update payload must omit sourceContentHtml"
  );
  assert.equal(
    "source_content_html" in withSource.data,
    false,
    "parsed update payload must omit source_content_html"
  );
}

console.log("lesson editor schema tests passed");
