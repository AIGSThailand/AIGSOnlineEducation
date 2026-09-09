/**
 * Phase 1 — inventory media URLs in course content (read-only).
 *
 * Scans Postgres for WordPress / absolute media URLs and writes a JSON report.
 * Does NOT upload to S3 or rewrite the database.
 *
 * Usage:
 *   npm run inventory:media
 *   npm run inventory:media -- --env local
 *   npm run inventory:media -- --out tmp/media-inventory.json
 *   npm run inventory:media -- --course <uuid>
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";
import {
  extractUrlsFromHtml,
  extractUrlsFromJson,
  extractUrlsFromPlainField,
  normalizeMediaUrl,
  proposeObjectKey,
  type ExtractedHit,
  type MediaCategory,
  type MediaReference,
} from "./lib/media-inventory-extract";
import type { MediaAssetKind } from "../features/media/types";

type InventoryAsset = {
  normalizedUrl: string;
  sampleUrl: string;
  category: MediaCategory;
  kindGuess: MediaAssetKind;
  host: string | null;
  pathname: string | null;
  fileName: string | null;
  courseIds: string[];
  proposedKey: string | null;
  referenceCount: number;
  references: MediaReference[];
};

function parseArgs(argv: string[]): {
  courseId?: string;
  outPath: string;
  includeQuizzes: boolean;
} {
  const args = stripEnvArgs(argv.filter((a) => a !== "--"));
  const courseIdx = args.indexOf("--course");
  const outIdx = args.indexOf("--out");
  return {
    courseId: courseIdx >= 0 ? args[courseIdx + 1] : undefined,
    outPath:
      outIdx >= 0 && args[outIdx + 1]
        ? args[outIdx + 1]
        : path.join("tmp", `media-inventory-${new Date().toISOString().slice(0, 10)}.json`),
    includeQuizzes: args.includes("--include-quizzes"),
  };
}

async function fetchAll<T extends Record<string, unknown>>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  select: string,
  apply?: (q: any) => any
): Promise<T[]> {
  const pageSize = 200;
  let offset = 0;
  const rows: T[] = [];

  while (true) {
    let q = supabase.from(table).select(select).range(offset, offset + pageSize - 1);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as T[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

function hostAndPath(normalized: string): { host: string | null; pathname: string | null } {
  if (normalized.startsWith("/")) {
    return { host: null, pathname: normalized };
  }
  const slash = normalized.indexOf("/");
  if (slash < 0) return { host: normalized, pathname: null };
  return {
    host: normalized.slice(0, slash),
    pathname: normalized.slice(slash),
  };
}

function mergeHits(hits: ExtractedHit[]): InventoryAsset[] {
  const map = new Map<string, InventoryAsset>();

  for (const hit of hits) {
    const key = `${hit.category}::${normalizeMediaUrl(hit.rawUrl)}`;
    const normalizedUrl = normalizeMediaUrl(hit.rawUrl);
    const { host, pathname } = hostAndPath(normalizedUrl);
    const courseId = hit.reference.courseId;
    let asset = map.get(key);
    if (!asset) {
      const primaryCourse = courseId;
      asset = {
        normalizedUrl,
        sampleUrl: hit.rawUrl,
        category: hit.category,
        kindGuess: hit.kindGuess,
        host,
        pathname,
        fileName: pathname?.split("/").pop() || null,
        courseIds: courseId ? [courseId] : [],
        proposedKey:
          hit.category === "migrate_candidate" && primaryCourse
            ? proposeObjectKey({
                courseId: primaryCourse,
                kind: hit.kindGuess,
                rawUrl: hit.rawUrl,
              })
            : null,
        referenceCount: 0,
        references: [],
      };
      map.set(key, asset);
    }

    asset.referenceCount += 1;
    if (asset.references.length < 25) {
      asset.references.push(hit.reference);
    }
    if (courseId && !asset.courseIds.includes(courseId)) {
      asset.courseIds.push(courseId);
    }
    if (!asset.proposedKey && hit.category === "migrate_candidate" && courseId) {
      asset.proposedKey = proposeObjectKey({
        courseId,
        kind: asset.kindGuess,
        rawUrl: hit.rawUrl,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.normalizedUrl.localeCompare(b.normalizedUrl);
  });
}

async function main(): Promise<void> {
  let envName: string;
  try {
    envName = parseEnvFlag(process.argv);
    const loaded = loadCliEnv(envName);
    console.log(`env file=${loaded.filePath} (--env ${envName})`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const opts = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const hits: ExtractedHit[] = [];

  console.log("Scanning courses…");
  const courses = await fetchAll<{
    id: string;
    title: string | null;
    description: string | null;
    thumbnail_url: string | null;
    promotional_video_url: string | null;
  }>(
    supabase,
    "courses",
    "id, title, description, thumbnail_url, promotional_video_url",
    opts.courseId ? (q) => q.eq("id", opts.courseId) : undefined
  );

  for (const course of courses) {
    const base = {
      table: "courses",
      rowId: course.id,
      courseId: course.id,
    };
    hits.push(
      ...extractUrlsFromHtml(course.description, { ...base, field: "description", context: "" })
    );
    hits.push(
      ...extractUrlsFromPlainField(course.thumbnail_url, {
        ...base,
        field: "thumbnail_url",
        context: "",
      })
    );
    hits.push(
      ...extractUrlsFromPlainField(course.promotional_video_url, {
        ...base,
        field: "promotional_video_url",
        context: "",
      })
    );
  }

  console.log(`  courses=${courses.length}`);

  console.log("Scanning lessons…");
  const lessons = await fetchAll<{
    id: string;
    course_id: string;
    content: string | null;
    content_json: unknown;
    source_content_html: string | null;
    video_url: string | null;
    featured_image_url: string | null;
    video_thumbnail_url: string | null;
    video_captions_url: string | null;
  }>(
    supabase,
    "lessons",
    "id, course_id, content, content_json, source_content_html, video_url, featured_image_url, video_thumbnail_url, video_captions_url",
    opts.courseId ? (q) => q.eq("course_id", opts.courseId) : undefined
  );

  for (const lesson of lessons) {
    const base = {
      table: "lessons",
      rowId: lesson.id,
      courseId: lesson.course_id,
    };
    hits.push(
      ...extractUrlsFromHtml(lesson.content, { ...base, field: "content", context: "" })
    );
    // Inventory only — do not rewrite source_content_html later; still list for awareness
    hits.push(
      ...extractUrlsFromHtml(lesson.source_content_html, {
        ...base,
        field: "source_content_html",
        context: "",
      })
    );
    hits.push(
      ...extractUrlsFromJson(lesson.content_json, { ...base, field: "content_json", context: "" })
    );
    for (const field of [
      "video_url",
      "featured_image_url",
      "video_thumbnail_url",
      "video_captions_url",
    ] as const) {
      hits.push(
        ...extractUrlsFromPlainField(lesson[field], {
          ...base,
          field,
          context: "",
        })
      );
    }
  }
  console.log(`  lessons=${lessons.length}`);

  console.log("Scanning lesson_resources…");
  const lessonIds = new Set(lessons.map((l) => l.id));
  const lessonCourse = new Map(lessons.map((l) => [l.id, l.course_id]));
  const resources = await fetchAll<{
    id: string;
    lesson_id: string;
    url: string | null;
    storage_path: string | null;
  }>(supabase, "lesson_resources", "id, lesson_id, url, storage_path");

  for (const res of resources) {
    if (opts.courseId && !lessonIds.has(res.lesson_id)) continue;
    const base = {
      table: "lesson_resources",
      rowId: res.id,
      courseId: lessonCourse.get(res.lesson_id) ?? null,
    };
    hits.push(
      ...extractUrlsFromPlainField(res.url, { ...base, field: "url", context: "" })
    );
    hits.push(
      ...extractUrlsFromPlainField(res.storage_path, {
        ...base,
        field: "storage_path",
        context: "",
      })
    );
  }
  console.log(`  lesson_resources scanned=${resources.length}`);

  if (opts.includeQuizzes) {
    console.log("Scanning questions (+ options)…");
    const questions = await fetchAll<{
      id: string;
      question_text: string | null;
      explanation: string | null;
    }>(supabase, "questions", "id, question_text, explanation");

    for (const q of questions) {
      const base = {
        table: "questions",
        rowId: q.id,
        courseId: null as string | null,
      };
      hits.push(
        ...extractUrlsFromHtml(q.question_text, { ...base, field: "question_text", context: "" })
      );
      hits.push(
        ...extractUrlsFromHtml(q.explanation, { ...base, field: "explanation", context: "" })
      );
    }

    const options = await fetchAll<{
      id: string;
      question_id: string;
      answer_text: string | null;
    }>(supabase, "question_options", "id, question_id, answer_text");

    for (const opt of options) {
      hits.push(
        ...extractUrlsFromHtml(opt.answer_text, {
          table: "question_options",
          rowId: opt.id,
          courseId: null,
          field: "answer_text",
          context: "",
        })
      );
    }
    console.log(`  questions=${questions.length} options=${options.length}`);
  }

  const assets = mergeHits(hits);
  const byCategory = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    env: envName,
    supabaseUrl: url,
    phase: 1,
    notes: [
      "Read-only inventory. No S3 upload and no DB rewrite.",
      "migrate_candidate rows are eligible for Phase 2 download→S3.",
      "source_content_html refs are listed for awareness; Phase 3 should rewrite content/content_json/columns only.",
      "proposedKey uses a stable migrated-{sha1}-{filename} prefix (no random UUID) so re-runs match.",
    ],
    filters: {
      courseId: opts.courseId ?? null,
      includeQuizzes: opts.includeQuizzes,
    },
    summary: {
      coursesScanned: courses.length,
      lessonsScanned: lessons.length,
      rawHits: hits.length,
      uniqueAssets: assets.length,
      byCategory,
      migrateCandidates: assets.filter((a) => a.category === "migrate_candidate").length,
      alreadyPrivate: assets.filter((a) => a.category === "already_private").length,
      embedSkipped: assets.filter((a) => a.category === "embed_skip").length,
    },
    assets,
  };

  const absOut = path.resolve(process.cwd(), opts.outPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(report, null, 2), "utf8");

  console.log("\nSummary");
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nWrote ${absOut}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
