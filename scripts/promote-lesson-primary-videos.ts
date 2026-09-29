/**
 * Promote unambiguous HTML-embedded videos into lessons.video_url (primary player).
 *
 * Only processes `promote_candidate` rows (exactly one playable embed, empty video_url).
 * Does NOT strip or rewrite lesson HTML — dual players may appear until instructors clean HTML.
 *
 * Usage:
 *   npm run promote:lesson-videos -- --from tmp/lesson-video-inventory.json
 *   npm run promote:lesson-videos -- --from tmp/lesson-video-inventory.json --apply
 *   npm run promote:lesson-videos -- --course <uuid> --apply
 *   npm run promote:lesson-videos -- --env staging --from tmp/….json --apply
 *
 * Production writes require --allow-production-write.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";
import { classifyVideoUrl } from "../lib/utils/video-embed";

type InventoryLesson = {
  lessonId: string;
  courseId: string | null;
  title: string;
  classification: string;
  videoUrl: string | null;
  proposedPrimaryUrl: string | null;
};

type InventoryFile = {
  generatedAt?: string;
  env?: string;
  courseId?: string | null;
  lessons: InventoryLesson[];
};

type PromotePlanRow = {
  lessonId: string;
  courseId: string | null;
  title: string;
  proposedPrimaryUrl: string;
  videoProvider: string;
  action: "would_update" | "updated" | "skipped" | "failed";
  reason?: string;
  previous?: {
    video_url: string | null;
    video_provider: string | null;
  };
};

function parseArgs(argv: string[]) {
  const args = stripEnvArgs(argv.filter((a) => a !== "--"));
  const apply = args.includes("--apply");
  if (apply && args.includes("--dry-run")) {
    throw new Error("Pass either --dry-run or --apply, not both.");
  }
  const courseIdx = args.indexOf("--course");
  const fromIdx = args.indexOf("--from");
  const outIdx = args.indexOf("--out");
  const backupIdx = args.indexOf("--backup");
  return {
    apply,
    allowProductionWrite:
      args.includes("--allow-production-write") ||
      process.env.ALLOW_LESSON_VIDEO_PROMOTE_PRODUCTION === "true",
    courseId: courseIdx >= 0 ? args[courseIdx + 1] : undefined,
    fromPath: fromIdx >= 0 ? args[fromIdx + 1] : undefined,
    outPath:
      outIdx >= 0 && args[outIdx + 1]
        ? args[outIdx + 1]
        : path.join(
            "tmp",
            `lesson-video-promote-${apply ? "apply" : "dryrun"}-${new Date().toISOString().slice(0, 10)}.json`
          ),
    backupPath:
      backupIdx >= 0 && args[backupIdx + 1]
        ? args[backupIdx + 1]
        : path.join(
            "tmp",
            `lesson-video-promote-backup-${new Date().toISOString().slice(0, 10)}.json`
          ),
  };
}

function inferProvider(url: string): string {
  const kind = classifyVideoUrl(url);
  if (kind === "youtube") return "youtube";
  if (kind === "vimeo") return "vimeo";
  if (kind === "file") return "self_hosted";
  if (/bunny|b-cdn\.net/i.test(url)) return "bunny";
  if (/cloudflarestream/i.test(url)) return "cloudflare";
  return "external";
}

function loadCandidates(fromPath: string | undefined, courseId?: string): InventoryLesson[] {
  if (!fromPath) {
    throw new Error(
      "Provide --from <inventory.json> (run npm run inventory:lesson-videos first)."
    );
  }
  const abs = path.resolve(process.cwd(), fromPath);
  if (!fs.existsSync(abs)) throw new Error(`Inventory file not found: ${abs}`);
  const json = JSON.parse(fs.readFileSync(abs, "utf8")) as InventoryFile;
  let rows = (json.lessons || []).filter(
    (l) =>
      l.classification === "promote_candidate" &&
      Boolean(l.proposedPrimaryUrl?.trim()) &&
      !l.videoUrl?.trim()
  );
  if (courseId) {
    rows = rows.filter((l) => l.courseId === courseId);
  }
  return rows;
}

async function main() {
  const envName = parseEnvFlag(process.argv);
  const loaded = loadCliEnv(envName);
  console.log(`env file=${loaded.filePath} (--env ${envName})`);

  const opts = parseArgs(process.argv);
  if (opts.apply && envName === "production" && !opts.allowProductionWrite) {
    throw new Error(
      "Refusing production apply without --allow-production-write (or ALLOW_LESSON_VIDEO_PROMOTE_PRODUCTION=true)."
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const candidates = loadCandidates(opts.fromPath, opts.courseId);
  const supabase = createClient(url, key);
  const plan: PromotePlanRow[] = [];
  const backupRows: Array<{
    lessonId: string;
    video_url: string | null;
    video_provider: string | null;
  }> = [];

  for (const row of candidates) {
    const proposed = row.proposedPrimaryUrl!.trim();
    const videoProvider = inferProvider(proposed);

    const { data: existing, error: readErr } = await supabase
      .from("lessons")
      .select("id, video_url, video_provider")
      .eq("id", row.lessonId)
      .maybeSingle<{
        id: string;
        video_url: string | null;
        video_provider: string | null;
      }>();

    if (readErr) {
      plan.push({
        lessonId: row.lessonId,
        courseId: row.courseId,
        title: row.title,
        proposedPrimaryUrl: proposed,
        videoProvider,
        action: "failed",
        reason: readErr.message,
      });
      continue;
    }

    if (!existing) {
      plan.push({
        lessonId: row.lessonId,
        courseId: row.courseId,
        title: row.title,
        proposedPrimaryUrl: proposed,
        videoProvider,
        action: "skipped",
        reason: "lesson not found",
      });
      continue;
    }

    if (existing.video_url?.trim()) {
      plan.push({
        lessonId: row.lessonId,
        courseId: row.courseId,
        title: row.title,
        proposedPrimaryUrl: proposed,
        videoProvider,
        action: "skipped",
        reason: "video_url already set",
        previous: {
          video_url: existing.video_url,
          video_provider: existing.video_provider,
        },
      });
      continue;
    }

    const previous = {
      video_url: existing.video_url,
      video_provider: existing.video_provider,
    };

    if (!opts.apply) {
      plan.push({
        lessonId: row.lessonId,
        courseId: row.courseId,
        title: row.title,
        proposedPrimaryUrl: proposed,
        videoProvider,
        action: "would_update",
        previous,
      });
      continue;
    }

    backupRows.push({
      lessonId: row.lessonId,
      video_url: existing.video_url,
      video_provider: existing.video_provider,
    });

    const { error: writeErr } = await supabase
      .from("lessons")
      .update({
        video_url: proposed,
        video_provider: videoProvider,
      } as never)
      .eq("id", row.lessonId)
      .is("video_url", null);

    if (writeErr) {
      plan.push({
        lessonId: row.lessonId,
        courseId: row.courseId,
        title: row.title,
        proposedPrimaryUrl: proposed,
        videoProvider,
        action: "failed",
        reason: writeErr.message,
        previous,
      });
      continue;
    }

    plan.push({
      lessonId: row.lessonId,
      courseId: row.courseId,
      title: row.title,
      proposedPrimaryUrl: proposed,
      videoProvider,
      action: "updated",
      previous,
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    env: envName,
    apply: opts.apply,
    from: opts.fromPath ?? null,
    courseId: opts.courseId ?? null,
    note: "HTML content was not modified. Clear video_url to roll back; restore from backup if needed.",
    totals: {
      candidates: candidates.length,
      would_update: plan.filter((p) => p.action === "would_update").length,
      updated: plan.filter((p) => p.action === "updated").length,
      skipped: plan.filter((p) => p.action === "skipped").length,
      failed: plan.filter((p) => p.action === "failed").length,
    },
    lessons: plan,
  };

  fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
  fs.writeFileSync(opts.outPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary.totals, null, 2));
  console.log(`Wrote ${opts.outPath}`);

  if (opts.apply && backupRows.length) {
    fs.mkdirSync(path.dirname(opts.backupPath), { recursive: true });
    fs.writeFileSync(
      opts.backupPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          env: envName,
          rows: backupRows,
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(`Backup ${opts.backupPath}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
