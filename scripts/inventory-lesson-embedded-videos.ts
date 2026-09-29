/**
 * Phase 1 — inventory lesson HTML for embedded videos (read-only / dry-run).
 *
 * Classifies each lesson as:
 *   - primary_ready: video_url already set (HTML embeds are secondary)
 *   - promote_candidate: no video_url, exactly one unambiguous video in HTML
 *   - multi_video_review: no video_url, multiple videos in HTML
 *   - html_only_links: video-like links but no playable embed tags
 *   - no_video: nothing found
 *
 * Does NOT rewrite content or set video_url.
 *
 * Usage:
 *   npm run inventory:lesson-videos
 *   npm run inventory:lesson-videos -- --env local
 *   npm run inventory:lesson-videos -- --out tmp/lesson-video-inventory.json
 *   npm run inventory:lesson-videos -- --course <uuid>
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";

type LessonScanRow = {
  id: string;
  course_id: string | null;
  title: string;
  video_url: string | null;
  content: string | null;
  source_content_html: string | null;
};

type VideoHit = {
  kind: "video_tag" | "iframe" | "mp4_link";
  src: string;
};

type LessonReport = {
  lessonId: string;
  courseId: string | null;
  title: string;
  classification:
    | "primary_ready"
    | "promote_candidate"
    | "multi_video_review"
    | "html_only_links"
    | "no_video";
  videoUrl: string | null;
  hits: VideoHit[];
  proposedPrimaryUrl: string | null;
};

function parseArgs(argv: string[]): { courseId?: string; outPath: string } {
  const args = stripEnvArgs(argv.filter((a) => a !== "--"));
  const courseIdx = args.indexOf("--course");
  const outIdx = args.indexOf("--out");
  return {
    courseId: courseIdx >= 0 ? args[courseIdx + 1] : undefined,
    outPath:
      outIdx >= 0 && args[outIdx + 1]
        ? args[outIdx + 1]
        : path.join(
            "tmp",
            `lesson-video-inventory-${new Date().toISOString().slice(0, 10)}.json`
          ),
  };
}

function decodeAttr(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractHits(html: string | null | undefined): VideoHit[] {
  if (!html) return [];
  const hits: VideoHit[] = [];
  const seen = new Set<string>();

  const push = (kind: VideoHit["kind"], raw: string) => {
    const src = decodeAttr(raw);
    if (!src || seen.has(src)) return;
    seen.add(src);
    hits.push({ kind, src });
  };

  for (const m of html.matchAll(/<video\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/\ssrc\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (src) push("video_tag", src);
  }
  for (const m of html.matchAll(/<source\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/\ssrc\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (src && /\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(src)) push("video_tag", src);
  }
  for (const m of html.matchAll(/<iframe\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/\ssrc\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (
      src &&
      /(youtube|youtu\.be|vimeo|player\.vimeo|bunny|cloudflarestream)/i.test(src)
    ) {
      push("iframe", src);
    }
  }
  for (const m of html.matchAll(/<a\b[^>]*\shref\s*=\s*(["'])(.*?)\1[^>]*>/gi)) {
    const href = m[2];
    if (href && /\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(href)) push("mp4_link", href);
  }

  return hits;
}

function classify(row: LessonScanRow, hits: VideoHit[]): LessonReport {
  const playable = hits.filter((h) => h.kind === "video_tag" || h.kind === "iframe");
  const linksOnly = hits.filter((h) => h.kind === "mp4_link");

  if (row.video_url?.trim()) {
    return {
      lessonId: row.id,
      courseId: row.course_id,
      title: row.title,
      classification: "primary_ready",
      videoUrl: row.video_url,
      hits,
      proposedPrimaryUrl: null,
    };
  }

  if (playable.length === 1) {
    return {
      lessonId: row.id,
      courseId: row.course_id,
      title: row.title,
      classification: "promote_candidate",
      videoUrl: null,
      hits,
      proposedPrimaryUrl: playable[0].src,
    };
  }

  if (playable.length > 1) {
    return {
      lessonId: row.id,
      courseId: row.course_id,
      title: row.title,
      classification: "multi_video_review",
      videoUrl: null,
      hits,
      proposedPrimaryUrl: null,
    };
  }

  if (linksOnly.length > 0) {
    return {
      lessonId: row.id,
      courseId: row.course_id,
      title: row.title,
      classification: "html_only_links",
      videoUrl: null,
      hits,
      proposedPrimaryUrl: linksOnly.length === 1 ? linksOnly[0].src : null,
    };
  }

  return {
    lessonId: row.id,
    courseId: row.course_id,
    title: row.title,
    classification: "no_video",
    videoUrl: null,
    hits: [],
    proposedPrimaryUrl: null,
  };
}

async function fetchLessons(
  supabase: ReturnType<typeof createClient>,
  courseId?: string
): Promise<LessonScanRow[]> {
  const pageSize = 200;
  let offset = 0;
  const rows: LessonScanRow[] = [];
  while (true) {
    let q = supabase
      .from("lessons")
      .select("id, course_id, title, video_url, content, source_content_html")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (courseId) q = q.eq("course_id", courseId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as LessonScanRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function main() {
  const envName = parseEnvFlag(process.argv);
  loadCliEnv(envName);
  const { courseId, outPath } = parseArgs(process.argv);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL and service/anon key.");
  }

  const supabase = createClient(url, key);
  const lessons = await fetchLessons(supabase, courseId);
  const reports = lessons.map((row) => {
    const hits = [
      ...extractHits(row.content),
      ...extractHits(row.source_content_html),
    ];
    // de-dupe across content + source
    const seen = new Set<string>();
    const unique = hits.filter((h) => {
      const k = `${h.kind}:${h.src}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return classify(row, unique);
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    env: envName,
    courseId: courseId ?? null,
    totals: {
      lessons: reports.length,
      primary_ready: reports.filter((r) => r.classification === "primary_ready").length,
      promote_candidate: reports.filter((r) => r.classification === "promote_candidate")
        .length,
      multi_video_review: reports.filter((r) => r.classification === "multi_video_review")
        .length,
      html_only_links: reports.filter((r) => r.classification === "html_only_links")
        .length,
      no_video: reports.filter((r) => r.classification === "no_video").length,
    },
    lessons: reports.filter((r) => r.classification !== "no_video"),
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary.totals, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
