/**
 * Unit checks for Phase 3 media URL rewrite helpers.
 * Run: npx tsx scripts/test-media-rewrite.ts
 */

import {
  buildRewriteLookup,
  resolveStableUrl,
  rewriteHtmlForCourse,
} from "./lib/media-rewrite";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const courseId = "69fe6371-4a4b-4355-9178-ee0d86a229cc";
const key =
  "courses/69fe6371-4a4b-4355-9178-ee0d86a229cc/lesson-image/migrated-ab0c31ce86cd-12-rays-star-ruby-4.png";
const stable = `/api/media/file?key=${encodeURIComponent(key)}`;

const lookup = buildRewriteLookup({
  host: "edu.aigsthailand.com",
  uploaded: [
    {
      sampleUrl:
        "https://edu.aigsthailand.com/wp-content/uploads/2022/01/12-Rays-Star-Ruby-4.png",
      normalizedUrl:
        "edu.aigsthailand.com/wp-content/uploads/2022/01/12-rays-star-ruby-4.png".replace(
          "12-rays",
          "12-Rays"
        ),
      courseId,
      key,
      status: "uploaded",
      stableUrl: stable,
    },
  ],
});

// Fix normalized to match inventory style (case preserved in path from normalizeMediaUrl)
const lookup2 = buildRewriteLookup({
  host: "edu.aigsthailand.com",
  uploaded: [
    {
      sampleUrl:
        "https://edu.aigsthailand.com/wp-content/uploads/2022/01/12-Rays-Star-Ruby-4.png",
      normalizedUrl:
        "edu.aigsthailand.com/wp-content/uploads/2022/01/12-Rays-Star-Ruby-4.png",
      courseId,
      key,
      status: "uploaded",
      stableUrl: stable,
    },
  ],
});

assert(
  resolveStableUrl(
    lookup2,
    courseId,
    "https://edu.aigsthailand.com/wp-content/uploads/2022/01/12-Rays-Star-Ruby-4.png"
  ) === stable,
  "direct resolve"
);

assert(
  resolveStableUrl(
    lookup2,
    courseId,
    "https://edu.aigsthailand.com/wp-content/uploads/2022/01/12-Rays-Star-Ruby-4-150x115.png"
  ) === stable,
  "resized → full"
);

const html = rewriteHtmlForCourse(
  `<img src="https://edu.aigsthailand.com/wp-content/uploads/2022/01/12-Rays-Star-Ruby-4-300x230.png">`,
  courseId,
  lookup2
);
assert(html.replacements === 1 && html.next?.includes("/api/media/file?key="), "html rewrite");
assert(!html.next?.includes("edu.aigsthailand.com"), "host removed");

void lookup;
console.log("test-media-rewrite: ok");
