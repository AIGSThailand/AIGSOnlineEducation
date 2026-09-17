import assert from "node:assert/strict";
import {
  previewMediaKeys,
  previewMediaUrl,
  previewContentHtml,
} from "../features/lessons/preview-media";
import { classifyVideoUrl } from "../lib/utils/video-embed";

const course = "11111111-1111-4111-8111-111111111111";
const lesson = "22222222-2222-4222-8222-222222222222";
const key = (name: string) => `courses/${course}/attachment/${name}`;
const url = (name: string) => `/api/media/file?key=${encodeURIComponent(key(name))}`;
const preview = {
  video_url: url("main.mp4"),
  video_captions_url: url("captions.vtt"),
  content: `<img src="${url("image.png")}"><video src="${url("embedded.webm")}"></video>
    <iframe src="${url("legacy.mp4")}"></iframe>
    <a href="${url("handout.pdf")}">Download handout</a>
    <img data-src="${url("hidden.png")}"><!-- <img src="${url("comment.png")}"> -->
    <img src="${url("disguised.pdf")}"><img src="https://other.test${url("external.png")}">`,
};
const keys = previewMediaKeys(preview, [course]);
assert.equal(previewMediaKeys(preview, [lesson]).size, 0, "Unrelated course assets stay protected");
for (const name of ["main.mp4", "captions.vtt", "image.png", "embedded.webm", "legacy.mp4"])
  assert(keys.has(key(name)), name);
for (const name of [
  "handout.pdf",
  "hidden.png",
  "comment.png",
  "disguised.pdf",
  "external.png",
  "other.mp4",
])
  assert(!keys.has(key(name)), name);
assert.equal(
  previewMediaKeys({ content: null, video_url: null, video_captions_url: null }, [course]).size,
  0
);
const resolved = new URL(previewMediaUrl(url("main.mp4"), course, lesson), "https://test.invalid");
assert.equal(resolved.searchParams.get("key"), key("main.mp4"));
assert.equal(resolved.searchParams.get("previewCourseId"), course);
assert.equal(resolved.searchParams.get("previewLessonId"), lesson);
assert.equal(classifyVideoUrl(resolved.toString()), "file");
const html = previewContentHtml(preview.content, course, lesson);
assert(!html.includes("<a "));
assert(!html.includes("<!--"));
assert(html.includes("previewCourseId="));
assert(html.includes("&amp;previewLessonId="));
assert.equal(
  previewMediaUrl("https://www.youtube.com/watch?v=example", course, lesson),
  "https://www.youtube.com/watch?v=example"
);
console.log("Lesson preview media boundary checks passed.");
