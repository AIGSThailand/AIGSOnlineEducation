/**
 * Compare Phase 2 manifest course IDs against a target Supabase env.
 * Usage: npx tsx scripts/check-media-rewrite-target.ts --env production
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { loadCliEnv, parseEnvFlag } from "./lib/load-cli-env.mjs";

async function main() {
  const envName = parseEnvFlag(process.argv);
  const loaded = loadCliEnv(envName);
  console.log(`env file=${loaded.filePath} (--env ${envName})`);
  console.log(`supabase=${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL/service role");

  const manifests = [
    "tmp/media-migrate-edu.aigsthailand.com-write.json",
    "tmp/media-migrate-retry.json",
  ];
  const courseIds = new Set<string>();
  for (const f of manifests) {
    const abs = path.resolve(f);
    if (!fs.existsSync(abs)) continue;
    const json = JSON.parse(fs.readFileSync(abs, "utf8")) as {
      results: Array<{ status: string; courseId: string }>;
    };
    for (const r of json.results || []) {
      if (r.status === "uploaded" && r.courseId) courseIds.add(r.courseId);
    }
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { count: courseCount, error: cErr } = await sb
    .from("courses")
    .select("id", { count: "exact", head: true });
  if (cErr) throw cErr;

  const { data: sample, error: sErr } = await sb
    .from("courses")
    .select("id, title")
    .limit(3);
  if (sErr) throw sErr;

  let matched = 0;
  let missing = 0;
  const missingIds: string[] = [];
  for (const id of courseIds) {
    const { data, error } = await sb.from("courses").select("id").eq("id", id).maybeSingle();
    if (error) throw error;
    if (data?.id) matched += 1;
    else {
      missing += 1;
      if (missingIds.length < 8) missingIds.push(id);
    }
  }

  const { count: wpHits } = await sb
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .ilike("content", "%edu.aigsthailand.com%");

  console.log(
    JSON.stringify(
      {
        env: envName,
        coursesInDb: courseCount,
        sampleCourses: sample,
        manifestCourseIds: courseIds.size,
        matchedCourseIds: matched,
        missingCourseIds: missing,
        missingSample: missingIds,
        lessonsStillWithWpHost: wpHits,
        safeToRewrite:
          missing === 0 && courseIds.size > 0 && (wpHits == null || wpHits > 0),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
