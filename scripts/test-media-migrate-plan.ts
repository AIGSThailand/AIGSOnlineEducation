/**
 * Unit checks for Phase 2 media migrate planning.
 * Run: npx tsx scripts/test-media-migrate-plan.ts
 */

import {
  buildUploadJobs,
  fullSizeNormalizedUrl,
  isWordPressResizedFileName,
} from "./lib/media-migrate-plan";
import type { MediaAssetKind } from "../features/media/types";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(isWordPressResizedFileName("a-150x115.png"), "detect resized");
assert(!isWordPressResizedFileName("a.png"), "full not resized");
assert(
  fullSizeNormalizedUrl("edu.aigsthailand.com/wp-content/uploads/a-150x115.png", "a-150x115.png") ===
    "edu.aigsthailand.com/wp-content/uploads/a.png",
  "full sibling path"
);

const kind: MediaAssetKind = "lesson-image";
const { jobs, skipped } = buildUploadJobs({
  host: "edu.aigsthailand.com",
  assets: [
    {
      normalizedUrl: "edu.aigsthailand.com/wp-content/uploads/a.png",
      sampleUrl: "https://edu.aigsthailand.com/wp-content/uploads/a.png",
      category: "migrate_candidate",
      kindGuess: kind,
      host: "edu.aigsthailand.com",
      pathname: "/wp-content/uploads/a.png",
      fileName: "a.png",
      courseIds: ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"],
    },
    {
      normalizedUrl: "edu.aigsthailand.com/wp-content/uploads/a-150x115.png",
      sampleUrl: "https://edu.aigsthailand.com/wp-content/uploads/a-150x115.png",
      category: "migrate_candidate",
      kindGuess: kind,
      host: "edu.aigsthailand.com",
      pathname: "/wp-content/uploads/a-150x115.png",
      fileName: "a-150x115.png",
      courseIds: ["11111111-1111-1111-1111-111111111111"],
    },
  ],
});

assert(jobs.length === 2, `expected 2 per-course jobs for full, got ${jobs.length}`);
assert(skipped.length === 1 && skipped[0].reason === "resized_has_full", "skip resized");
assert(jobs[0].courseId !== jobs[1].courseId, "one key per course");
assert(jobs[0].key !== jobs[1].key, "distinct keys");

console.log("test-media-migrate-plan: ok");
