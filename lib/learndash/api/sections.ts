import { learndashFetch } from "../client";
import { LearnDashError } from "../errors";
import type { LearnDashEntityId } from "../types/common";
import type { LearnDashSectionHeading } from "../types/section";
import { extractSectionsFromEntity, parseLearnDashCourseSections } from "../parse-sections";

const LD_COURSE_PATH = "/wp-json/ldlms/v2/sfwd-courses";
const WP_COURSE_PATH = "/wp-json/wp/v2/sfwd-courses";
const LD_SECTIONS_PATH = "/wp-json/ldlms/v1/sections";

async function tryFetch(path: string, query?: Record<string, string>): Promise<unknown | null> {
  try {
    const { data } = await learndashFetch<unknown>({ path, query });
    return data;
  } catch (err) {
    // Auth failures should fail the migration loudly; missing routes/fields are soft.
    if (err instanceof LearnDashError && err.code === "LEARNDASH_AUTH_FAILED") {
      throw err;
    }
    return null;
  }
}

/**
 * Load LearnDash builder section headings for a course.
 *
 * Primary source on this site: `GET …/sfwd-courses/{id}/steps` → `sections`
 * (includes `post_title`, `order`, and member lesson `steps` ids).
 * Course entity meta does not expose `course_sections` via REST here.
 */
export async function getLearnDashCourseSections(
  courseId: LearnDashEntityId
): Promise<LearnDashSectionHeading[]> {
  const attempts: Array<() => Promise<unknown | null>> = [
    // Authoritative on AIGS WP: sections live on the steps payload
    () => tryFetch(`${LD_COURSE_PATH}/${courseId}/steps`),
    () => tryFetch(`/wp-json/ldlms/v1/sfwd-courses/${courseId}/steps`),
    () => tryFetch(`${LD_COURSE_PATH}/${courseId}`, { context: "edit" }),
    () => tryFetch(`${WP_COURSE_PATH}/${courseId}`, { context: "edit" }),
    () => tryFetch(`${LD_SECTIONS_PATH}/${courseId}`),
    () => tryFetch(`${LD_COURSE_PATH}/${courseId}/sections`),
  ];

  for (const attempt of attempts) {
    const data = await attempt();
    if (data == null) continue;

    const fromEntity = extractSectionsFromEntity(data);
    if (fromEntity.length > 0) return fromEntity;

    const direct = parseLearnDashCourseSections(data);
    if (direct.length > 0) return direct;
  }

  return [];
}
