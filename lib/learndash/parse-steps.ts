import type { LearnDashEntityId } from "./types/common";
import type { LearnDashStepNode, LearnDashStepType } from "./types/course-step";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toId(value: unknown): LearnDashEntityId | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function mapSourceType(sourceType: string): LearnDashStepType {
  const key = sourceType.toLowerCase();
  if (key.includes("lesson")) return "lesson";
  if (key.includes("topic")) return "topic";
  if (key.includes("quiz")) return "quiz";
  return "unknown";
}

/**
 * Unwrap common LearnDash wrappers around the steps tree.
 * Observed variants:
 * - `{ steps: { h: { "sfwd-lessons": {...} } } }`
 * - `{ h: { "sfwd-lessons": {...} } }`
 * - `{ "sfwd-lessons": {...}, "sfwd-quiz": {...} }`
 * - array of `{ id, type, children }`
 */
export function unwrapStepsTree(raw: unknown): unknown {
  const root = asRecord(raw);
  if (!root) return raw;

  if (root.steps !== undefined) {
    return unwrapStepsTree(root.steps);
  }
  if (root.h !== undefined) {
    return unwrapStepsTree(root.h);
  }
  return raw;
}

function parseChildrenObject(children: unknown): LearnDashStepNode[] {
  const record = asRecord(children);
  if (!record) return [];

  const nodes: LearnDashStepNode[] = [];

  for (const [sourceType, value] of Object.entries(record)) {
    if (sourceType === "h" || sourceType === "steps") continue;

    // Empty arrays: `"sfwd-topic": []`
    if (Array.isArray(value)) {
      for (const entry of value) {
        const id = toId(entry);
        if (id) {
          nodes.push({
            id,
            type: mapSourceType(sourceType),
            sourceType,
            children: [],
          });
        }
      }
      continue;
    }

    const group = asRecord(value);
    if (!group) continue;

    // IDs as keys: `"123": { "sfwd-topic": {...}, "sfwd-quiz": {...} }` or `"123": []`
    for (const [idKey, childValue] of Object.entries(group)) {
      const id = toId(idKey);
      if (!id) continue;

      let nested: LearnDashStepNode[] = [];
      if (Array.isArray(childValue)) {
        nested = [];
      } else if (asRecord(childValue)) {
        nested = parseChildrenObject(childValue);
      }

      nodes.push({
        id,
        type: mapSourceType(sourceType),
        sourceType,
        children: nested,
      });
    }
  }

  return nodes;
}

function parseArraySteps(raw: unknown[]): LearnDashStepNode[] {
  return raw
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const id = toId(row.id ?? row.ID ?? row.post_id);
      if (!id) return null;
      const sourceType = String(row.type || row.post_type || row.step_type || "unknown");
      const childrenRaw = row.children ?? row.steps ?? [];
      const children = Array.isArray(childrenRaw)
        ? parseArraySteps(childrenRaw)
        : parseChildrenObject(childrenRaw);
      return {
        id,
        type: mapSourceType(sourceType),
        sourceType,
        children,
      } satisfies LearnDashStepNode;
    })
    .filter((n): n is LearnDashStepNode => n !== null);
}

/**
 * Normalize LearnDash Course Steps into an ordered forest of nodes.
 * Order follows object key / array order as returned by the API.
 */
export function parseLearnDashCourseSteps(raw: unknown): {
  roots: LearnDashStepNode[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const unwrapped = unwrapStepsTree(raw);

  if (unwrapped == null) {
    warnings.push("Course steps payload is empty.");
    return { roots: [], warnings };
  }

  if (Array.isArray(unwrapped)) {
    return { roots: parseArraySteps(unwrapped), warnings };
  }

  const record = asRecord(unwrapped);
  if (!record) {
    warnings.push("Course steps payload is not an object or array; hierarchy may be incomplete.");
    return { roots: [], warnings };
  }

  // Top-level is already `"sfwd-lessons" | "sfwd-quiz" | ...`
  const roots = parseChildrenObject(record);
  if (roots.length === 0) {
    warnings.push("No step nodes could be parsed from course steps payload.");
  }
  return { roots, warnings };
}

export function collectStepIds(roots: LearnDashStepNode[]): {
  lessonIds: LearnDashEntityId[];
  topicIds: LearnDashEntityId[];
  quizIds: LearnDashEntityId[];
  unknown: Array<{ id: LearnDashEntityId; sourceType: string }>;
} {
  const lessonIds = new Set<LearnDashEntityId>();
  const topicIds = new Set<LearnDashEntityId>();
  const quizIds = new Set<LearnDashEntityId>();
  const unknown: Array<{ id: LearnDashEntityId; sourceType: string }> = [];

  const walk = (nodes: LearnDashStepNode[]) => {
    for (const node of nodes) {
      if (node.type === "lesson") lessonIds.add(node.id);
      else if (node.type === "topic") topicIds.add(node.id);
      else if (node.type === "quiz") quizIds.add(node.id);
      else unknown.push({ id: node.id, sourceType: node.sourceType });
      walk(node.children);
    }
  };

  walk(roots);
  return {
    lessonIds: Array.from(lessonIds),
    topicIds: Array.from(topicIds),
    quizIds: Array.from(quizIds),
    unknown,
  };
}
