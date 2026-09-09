/**
 * Phase 3 — rewrite edu.aigsthailand.com media URLs in Postgres to
 * `/api/media/file?key=…` using Phase 2 upload manifests.
 *
 * Does NOT modify lessons.source_content_html (audit copy).
 *
 * Usage:
 *   npm run rewrite:media-urls -- --env local --dry-run
 *   npm run rewrite:media-urls -- --env local --write
 *   npm run rewrite:media-urls -- --env local --write --course <uuid>
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";
import {
  buildRewriteLookup,
  rewriteHtmlForCourse,
  rewriteJsonValue,
  rewritePlainUrlField,
  type ManifestResult,
} from "./lib/media-rewrite";

const HOST = "edu.aigsthailand.com";

function parseArgs(argv: string[]) {
  const args = stripEnvArgs(argv.filter((a) => a !== "--"));
  const write = args.includes("--write");
  if (write && args.includes("--dry-run")) {
    throw new Error("Pass either --dry-run or --write, not both.");
  }
  const courseIdx = args.indexOf("--course");
  const outIdx = args.indexOf("--out");
  return {
    dryRun: !write,
    courseId: courseIdx >= 0 ? args[courseIdx + 1] : undefined,
    outPath:
      outIdx >= 0 && args[outIdx + 1]
        ? args[outIdx + 1]
        : path.join("tmp", `media-rewrite-${write ? "write" : "dryrun"}.json`),
  };
}

function loadUploadedResults(): ManifestResult[] {
  const files = [
    path.join("tmp", "media-migrate-edu.aigsthailand.com-write.json"),
    path.join("tmp", "media-migrate-retry.json"),
  ];
  const rows: ManifestResult[] = [];
  for (const f of files) {
    const abs = path.resolve(process.cwd(), f);
    if (!fs.existsSync(abs)) continue;
    const json = JSON.parse(fs.readFileSync(abs, "utf8")) as {
      results: ManifestResult[];
    };
    rows.push(...(json.results || []).filter((r) => r.status === "uploaded"));
  }
  return rows;
}

async function fetchAll<T>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  select: string,
  apply?: (q: any) => any
): Promise<T[]> {
  const pageSize = 100;
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

  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const uploaded = loadUploadedResults();
  if (!uploaded.length) {
    console.error("No uploaded manifest rows found in tmp/media-migrate-*.json");
    process.exit(1);
  }

  const lookup = buildRewriteLookup({ host: HOST, uploaded });
  console.log(
    JSON.stringify(
      {
        mode: opts.dryRun ? "dry-run" : "write",
        host: HOST,
        uploadedMapped: lookup.keys.size,
        courseFilter: opts.courseId ?? null,
      },
      null,
      2
    )
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const changes: Array<Record<string, unknown>> = [];
  let rowsTouched = 0;
  let replacements = 0;
  const unresolvedSample: string[] = [];

  // Courses
  const courses = await fetchAll<{
    id: string;
    description: string | null;
    thumbnail_url: string | null;
    promotional_video_url: string | null;
  }>(
    supabase,
    "courses",
    "id, description, thumbnail_url, promotional_video_url",
    opts.courseId ? (q) => q.eq("id", opts.courseId) : undefined
  );

  for (const course of courses) {
    const patch: Record<string, string | null> = {};
    let local = 0;

    const desc = rewriteHtmlForCourse(course.description, course.id, lookup);
    if (desc.replacements > 0 && desc.next !== course.description) {
      patch.description = desc.next;
      local += desc.replacements;
      unresolvedSample.push(...desc.unresolved.slice(0, 3));
    }

    for (const field of ["thumbnail_url", "promotional_video_url"] as const) {
      const r = rewritePlainUrlField(course[field], course.id, lookup);
      if (r.replaced && r.next !== course[field]) {
        patch[field] = r.next;
        local += 1;
      }
    }

    if (Object.keys(patch).length) {
      rowsTouched += 1;
      replacements += local;
      changes.push({ table: "courses", id: course.id, fields: Object.keys(patch), replacements: local });
      if (!opts.dryRun) {
        const { error } = await supabase.from("courses").update(patch).eq("id", course.id);
        if (error) throw new Error(`courses ${course.id}: ${error.message}`);
      }
    }
  }

  // Lessons (skip source_content_html)
  const lessons = await fetchAll<{
    id: string;
    course_id: string;
    content: string | null;
    content_json: unknown;
    video_url: string | null;
    featured_image_url: string | null;
    video_thumbnail_url: string | null;
    video_captions_url: string | null;
  }>(
    supabase,
    "lessons",
    "id, course_id, content, content_json, video_url, featured_image_url, video_thumbnail_url, video_captions_url",
    opts.courseId ? (q) => q.eq("course_id", opts.courseId) : undefined
  );

  for (const lesson of lessons) {
    const patch: Record<string, unknown> = {};
    let local = 0;

    const content = rewriteHtmlForCourse(lesson.content, lesson.course_id, lookup);
    if (content.replacements > 0 && content.next !== lesson.content) {
      patch.content = content.next;
      local += content.replacements;
      unresolvedSample.push(...content.unresolved.slice(0, 2));
    }

    if (lesson.content_json) {
      const json = rewriteJsonValue(lesson.content_json, lesson.course_id, lookup);
      if (json.replacements > 0) {
        patch.content_json = json.next;
        local += json.replacements;
      }
    }

    for (const field of [
      "video_url",
      "featured_image_url",
      "video_thumbnail_url",
      "video_captions_url",
    ] as const) {
      const r = rewritePlainUrlField(lesson[field], lesson.course_id, lookup);
      if (r.replaced && r.next !== lesson[field]) {
        patch[field] = r.next;
        local += 1;
      }
    }

    if (Object.keys(patch).length) {
      rowsTouched += 1;
      replacements += local;
      changes.push({
        table: "lessons",
        id: lesson.id,
        courseId: lesson.course_id,
        fields: Object.keys(patch),
        replacements: local,
      });
      if (!opts.dryRun) {
        const { error } = await supabase.from("lessons").update(patch).eq("id", lesson.id);
        if (error) throw new Error(`lessons ${lesson.id}: ${error.message}`);
      }
    }
  }

  // lesson_resources
  const lessonCourse = new Map(lessons.map((l) => [l.id, l.course_id]));
  const resources = await fetchAll<{
    id: string;
    lesson_id: string;
    url: string | null;
  }>(supabase, "lesson_resources", "id, lesson_id, url");

  for (const res of resources) {
    const courseId = lessonCourse.get(res.lesson_id);
    if (!courseId) continue;
    if (opts.courseId && courseId !== opts.courseId) continue;
    const r = rewritePlainUrlField(res.url, courseId, lookup);
    if (!r.replaced || r.next === res.url) continue;
    rowsTouched += 1;
    replacements += 1;
    changes.push({ table: "lesson_resources", id: res.id, fields: ["url"], replacements: 1 });
    if (!opts.dryRun) {
      const { error } = await supabase
        .from("lesson_resources")
        .update({ url: r.next })
        .eq("id", res.id);
      if (error) throw new Error(`lesson_resources ${res.id}: ${error.message}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    phase: 3,
    env: envName,
    host: HOST,
    dryRun: opts.dryRun,
    notes: [
      "source_content_html was not modified.",
      "Resized WP -WxH URLs rewrite to the full-size S3 object when mapped.",
      "URLs without an uploaded object for that course are left unchanged.",
    ],
    summary: {
      uploadedMapped: lookup.keys.size,
      rowsTouched,
      replacements,
      unresolvedSample: [...new Set(unresolvedSample)].slice(0, 20),
    },
    changes: changes.slice(0, 500),
    changesTruncated: changes.length > 500,
    changeCount: changes.length,
  };

  const absOut = path.resolve(process.cwd(), opts.outPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(report, null, 2), "utf8");
  console.log("\nSummary", JSON.stringify(report.summary, null, 2));
  console.log(`Wrote ${absOut}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
