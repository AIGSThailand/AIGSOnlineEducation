import type { LearnDashEntityId } from "./types/common";
import type { LearnDashSectionHeading } from "./types/section";

type RawSection = {
  ID?: unknown;
  id?: unknown;
  post_title?: unknown;
  title?: unknown;
  order?: unknown;
  type?: unknown;
  steps?: unknown;
};

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function asTitle(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function collectStepIds(raw: unknown): LearnDashEntityId[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    const ids = raw
      .map((x) => asFiniteNumber(x))
      .filter((n): n is number => n != null && n > 0);
    return ids.length ? ids : undefined;
  }
  if (typeof raw === "object") {
    // LD sometimes stores { "76824": {...}, "76825": {...} } or { "76824": 1 }
    const ids = Object.keys(raw as Record<string, unknown>)
      .map((k) => asFiniteNumber(k))
      .filter((n): n is number => n != null && n > 0);
    return ids.length ? ids : undefined;
  }
  return undefined;
}

/**
 * Normalize LearnDash `course_sections` meta (JSON string, WP meta wrapper, or array).
 */
export function parseLearnDashCourseSections(raw: unknown): LearnDashSectionHeading[] {
  let value: unknown = raw;

  // WP post meta often wraps as ["[{...}]"] or [{...}]
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === "string") {
    value = value[0];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      value = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) return [];

  const sections: LearnDashSectionHeading[] = [];
  for (let idx = 0; idx < value.length; idx++) {
    const row = value[idx] as RawSection;
    if (!row || typeof row !== "object") continue;

    const type = typeof row.type === "string" ? row.type : "section-heading";
    if (type && type !== "section-heading") continue;

    const order = asFiniteNumber(row.order) ?? idx + 1;
    const id = asFiniteNumber(row.ID) ?? asFiniteNumber(row.id);
    const title = asTitle(row.post_title ?? row.title, `Section ${idx + 1}`);
    const stepIds = collectStepIds(row.steps);

    sections.push({
      title,
      order,
      wordpressSectionId: id != null && id > 0 ? id : null,
      ...(stepIds ? { stepIds } : {}),
    });
  }

  return sections.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/**
 * Pull section headings from a course REST entity / meta bag.
 */
export function extractSectionsFromEntity(entity: unknown): LearnDashSectionHeading[] {
  if (!entity || typeof entity !== "object") return [];
  const obj = entity as Record<string, unknown>;

  const candidates: unknown[] = [obj.course_sections, obj.sections];

  const meta = obj.meta;
  if (meta && typeof meta === "object") {
    const m = meta as Record<string, unknown>;
    candidates.push(m.course_sections, m.sections);
  }

  for (const c of candidates) {
    const parsed = parseLearnDashCourseSections(c);
    if (parsed.length > 0) return parsed;
  }
  return [];
}

/**
 * Which section owns this 1-based lesson index when comparing against section.order
 * as if order were a lesson index (legacy `.ld` importer behavior).
 */
export function resolveSectionIndexByLessonIndex(
  lessonIndex1Based: number,
  sections: LearnDashSectionHeading[]
): number {
  if (!sections.length) return 0;
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  let index = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].order <= lessonIndex1Based) index = i;
    else break;
  }
  return index;
}

/**
 * Map each top-level lesson (0-based among lessons only) → section index.
 *
 * Prefer explicit `stepIds` on sections when present. Otherwise treat `order`
 * as LearnDash absolute builder position (headings + lessons share one sequence).
 */
export function mapLessonIndexesToSectionIndexes(
  lessonCount: number,
  sections: LearnDashSectionHeading[],
  lessonWordpressIds?: LearnDashEntityId[]
): number[] {
  if (lessonCount <= 0) return [];
  if (!sections.length) return Array.from({ length: lessonCount }, () => 0);

  const sorted = [...sections].sort((a, b) => a.order - b.order);

  // Enriched sections with step membership (from /steps → sections[].steps)
  const anyStepIds = sorted.some((s) => (s.stepIds?.length ?? 0) > 0);
  if (anyStepIds && lessonWordpressIds && lessonWordpressIds.length === lessonCount) {
    const owner = new Map<LearnDashEntityId, number>();
    sorted.forEach((s, idx) => {
      for (const id of s.stepIds || []) owner.set(id, idx);
    });

    const result = lessonWordpressIds.map((id) => owner.get(id) ?? -1);

    // Orphans (e.g. draft lessons missing from sections[].steps) inherit a neighbor section.
    for (let i = 0; i < result.length; i++) {
      if (result[i] >= 0) continue;
      let prev = -1;
      for (let j = i - 1; j >= 0; j--) {
        if (result[j] >= 0) {
          prev = result[j];
          break;
        }
      }
      let next = -1;
      for (let j = i + 1; j < result.length; j++) {
        if (result[j] >= 0) {
          next = result[j];
          break;
        }
      }
      if (prev >= 0) result[i] = prev;
      else if (next >= 0) result[i] = next;
      else result[i] = resolveSectionIndexByLessonIndex(i + 1, sorted);
    }

    return result;
  }

  // Absolute builder positions: section.order occupies a slot; lessons fill the rest.
  const headingAt = new Map<number, number>();
  sorted.forEach((s, idx) => headingAt.set(s.order, idx));

  const totalSlots = lessonCount + sorted.length;
  const maxOrder = Math.max(...sorted.map((s) => s.order), totalSlots);
  const walkUntil = Math.max(totalSlots, maxOrder);

  const result: number[] = [];
  let currentSectionIdx = 0;
  let seenHeading = false;

  for (let pos = 1; pos <= walkUntil && result.length < lessonCount; pos++) {
    const headingIdx = headingAt.get(pos);
    if (headingIdx != null) {
      currentSectionIdx = headingIdx;
      seenHeading = true;
      continue;
    }
    result.push(seenHeading ? currentSectionIdx : 0);
  }

  while (result.length < lessonCount) {
    result.push(Math.max(0, sorted.length - 1));
  }

  return result;
}
