/**
 * Smoke tests for video URL classification / HTML enhancement.
 * Run: npx tsx scripts/test-video-embed.ts
 */
import assert from "node:assert/strict";
import {
  classifyVideoUrl,
  enhanceHtmlVideoPlayback,
  toEmbedSrc,
} from "../lib/utils/video-embed";

assert.equal(classifyVideoUrl("https://cdn.example.com/lesson.mp4"), "file");
assert.equal(classifyVideoUrl("https://www.youtube.com/watch?v=abcdefghijk"), "youtube");
assert.equal(classifyVideoUrl("https://vimeo.com/123456"), "vimeo");

assert.equal(
  toEmbedSrc("https://www.youtube.com/watch?v=abcdefghijk"),
  "https://www.youtube.com/embed/abcdefghijk"
);

const fromLink = enhanceHtmlVideoPlayback(
  `<p><a href="https://cdn.example.com/a.mp4">Watch</a></p>`
);
assert.match(fromLink, /<video[^>]+src="https:\/\/cdn\.example\.com\/a\.mp4"/);
assert.match(fromLink, /controls/);
assert.match(fromLink, /playsinline/);

const fromIframe = enhanceHtmlVideoPlayback(
  `<iframe src="https://cdn.example.com/b.mp4"></iframe>`
);
assert.match(fromIframe, /<video[^>]+src="https:\/\/cdn\.example\.com\/b\.mp4"/);
assert.doesNotMatch(fromIframe, /<iframe/);

const keepYt = enhanceHtmlVideoPlayback(
  `<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>`
);
assert.match(keepYt, /youtube\.com\/embed/);

console.log("video embed tests passed");
