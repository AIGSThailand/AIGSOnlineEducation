/**
 * Quick unit checks for media inventory URL extraction (no DB).
 * Run: npx tsx scripts/test-media-inventory-extract.ts
 */

import {
  classifyUrl,
  extractUrlsFromHtml,
  extractUrlsFromJson,
  normalizeMediaUrl,
  proposeObjectKey,
} from "./lib/media-inventory-extract";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const ref = {
  table: "lessons",
  rowId: "l1",
  courseId: "11111111-1111-1111-1111-111111111111",
  field: "content",
  context: "",
};

assert(classifyUrl("https://youtu.be/abc") === "embed_skip", "youtube skip");
assert(
  classifyUrl("https://old.example/wp-content/uploads/2024/a.jpg") === "migrate_candidate",
  "wp upload"
);
assert(
  classifyUrl("/api/media/file?key=courses/x/lesson-image/a.png") === "already_private",
  "private proxy"
);

const htmlHits = extractUrlsFromHtml(
  `<p><img src="https://site.test/wp-content/uploads/x.png"><a href="https://vimeo.com/1">v</a></p>`,
  ref
);
assert(htmlHits.some((h) => h.category === "migrate_candidate"), "html image");
assert(htmlHits.some((h) => h.category === "embed_skip"), "html vimeo");

const jsonHits = extractUrlsFromJson(
  {
    type: "doc",
    content: [
      {
        type: "image",
        attrs: { src: "https://site.test/uploads/pic.webp" },
      },
    ],
  },
  { ...ref, field: "content_json" }
);
assert(jsonHits.length === 1 && jsonHits[0].category === "migrate_candidate", "tiptap image");

const key = proposeObjectKey({
  courseId: ref.courseId!,
  kind: "lesson-image",
  rawUrl: "https://site.test/wp-content/uploads/x.png?w=100",
});
assert(key.includes("migrated-"), "proposed key");
assert(
  normalizeMediaUrl("https://SITE.test/wp-content/uploads/x.png?w=100") ===
    "site.test/wp-content/uploads/x.png",
  "normalize"
);

console.log("test-media-inventory-extract: ok");
