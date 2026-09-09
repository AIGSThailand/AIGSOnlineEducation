/**
 * Deep-probe where LearnDash exposes course_sections for a course id.
 * Usage: npx tsx scripts/probe-course-sections.ts --env local 76822
 */
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";
import { isLearnDashConfigured } from "../lib/learndash/config";
import { learndashFetch } from "../lib/learndash/client";
import { extractSectionsFromEntity, parseLearnDashCourseSections } from "../lib/learndash/parse-sections";

function summarize(data: unknown): string {
  if (data == null) return "null";
  if (Array.isArray(data)) return `array(len=${data.length})`;
  if (typeof data !== "object") return typeof data;
  const keys = Object.keys(data as object).sort();
  return `object keys=[${keys.join(", ")}]`;
}

function findCourseSectionsKeys(obj: unknown, path = ""): string[] {
  const hits: string[] = [];
  if (!obj || typeof obj !== "object") return hits;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => hits.push(...findCourseSectionsKeys(v, `${path}[${i}]`)));
    return hits;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = path ? `${path}.${k}` : k;
    if (/section/i.test(k)) hits.push(`${p} => ${summarize(v)}`);
    if (v && typeof v === "object" && path.split(".").length < 4) {
      hits.push(...findCourseSectionsKeys(v, p));
    }
  }
  return hits;
}

async function tryPath(label: string, path: string, query?: Record<string, string>) {
  console.log(`\n--- ${label} ---`);
  console.log(`GET ${path}${query ? "?" + new URLSearchParams(query).toString() : ""}`);
  try {
    const { data, status } = await learndashFetch<unknown>({ path, query });
    console.log(`status=${status} shape=${summarize(data)}`);
    const sectionKeys = findCourseSectionsKeys(data);
    if (sectionKeys.length) {
      console.log("section-related fields:");
      for (const h of sectionKeys.slice(0, 40)) console.log(`  ${h}`);
    } else {
      console.log("no *section* keys found");
    }
    const extracted = extractSectionsFromEntity(data);
    const direct = parseLearnDashCourseSections(data);
    console.log(`extractSectionsFromEntity => ${extracted.length}`);
    if (extracted.length) {
      for (const s of extracted) console.log(`  order=${s.order} title=${s.title}`);
    }
    console.log(`parseLearnDashCourseSections(data) => ${direct.length}`);

    // If meta.course_sections exists, print raw preview
    if (data && typeof data === "object") {
      const meta = (data as Record<string, unknown>).meta;
      if (meta && typeof meta === "object") {
        const cs = (meta as Record<string, unknown>).course_sections;
        if (cs != null) {
          const preview = typeof cs === "string" ? cs.slice(0, 300) : JSON.stringify(cs).slice(0, 300);
          console.log(`meta.course_sections preview: ${preview}`);
        }
      }
      const top = (data as Record<string, unknown>).course_sections;
      if (top != null) {
        const preview = typeof top === "string" ? top.slice(0, 300) : JSON.stringify(top).slice(0, 300);
        console.log(`course_sections preview: ${preview}`);
      }
    }
  } catch (err) {
    console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
  }
}

async function main() {
  const envName = parseEnvFlag(process.argv);
  loadCliEnv(envName);
  const args = stripEnvArgs(process.argv.slice(2).filter((a) => a !== "--"));
  const courseId = Number(args.find((a) => /^\d+$/.test(a)) || 76822);

  if (!isLearnDashConfigured()) {
    console.error("LearnDash not configured");
    process.exit(1);
  }

  console.log(`Probing course_sections for course ${courseId}`);

  await tryPath("LD v2 course view", `/wp-json/ldlms/v2/sfwd-courses/${courseId}`);
  await tryPath("LD v2 course edit", `/wp-json/ldlms/v2/sfwd-courses/${courseId}`, { context: "edit" });
  await tryPath("WP v2 course edit", `/wp-json/wp/v2/sfwd-courses/${courseId}`, { context: "edit" });
  await tryPath("LD v1 sections", `/wp-json/ldlms/v1/sections/${courseId}`);
  await tryPath("LD v2 course/sections", `/wp-json/ldlms/v2/sfwd-courses/${courseId}/sections`);
  await tryPath("LD v1 course", `/wp-json/ldlms/v1/sfwd-courses/${courseId}`, { context: "edit" });
  await tryPath("LD v2 steps", `/wp-json/ldlms/v2/sfwd-courses/${courseId}/steps`);
  await tryPath("LD v1 steps", `/wp-json/ldlms/v1/sfwd-courses/${courseId}/steps`);
  await tryPath("WP meta course_sections via search", `/wp-json/wp/v2/sfwd-courses/${courseId}`, {
    context: "edit",
    _fields: "id,title,slug,meta,course_sections",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
