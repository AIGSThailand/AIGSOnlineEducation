import type { CourseStructureModuleItem, CurriculumItem } from "@/features/courses/types";

export type CurriculumDragId = `section:${string}` | `item:${string}`;

export function sectionDragId(sectionId: string): CurriculumDragId {
  return `section:${sectionId}`;
}

export function itemDragId(item: Pick<CurriculumItem, "kind" | "id">): CurriculumDragId {
  return `item:${item.kind}:${item.id}`;
}

export function parseDragId(
  id: string
): { type: "section"; id: string } | { type: "item"; kind: string; id: string } | null {
  if (id.startsWith("section:")) {
    return { type: "section", id: id.slice("section:".length) };
  }
  if (id.startsWith("item:")) {
    const rest = id.slice("item:".length);
    const sep = rest.indexOf(":");
    if (sep === -1) return null;
    return { type: "item", kind: rest.slice(0, sep), id: rest.slice(sep + 1) };
  }
  return null;
}

export interface CurriculumContainers {
  sectionOrder: string[];
  itemsBySection: Record<string, CurriculumDragId[]>;
}

export function structureToContainers(
  structure: CourseStructureModuleItem[]
): CurriculumContainers {
  const sectionOrder = structure.map((s) => s.id);
  const itemsBySection: Record<string, CurriculumDragId[]> = {};

  for (const section of structure) {
    const items: CurriculumItem[] =
      section.items.length > 0
        ? section.items
        : section.lessons.map((l) => ({ ...l, kind: "lesson" as const }));

    itemsBySection[section.id] = items.map((item) => itemDragId(item));
  }

  return { sectionOrder, itemsBySection };
}

export function containersToOrderPayload(
  structure: CourseStructureModuleItem[],
  containers: CurriculumContainers
) {
  const sectionById = new Map(structure.map((s) => [s.id, s]));

  return {
    sectionIds: containers.sectionOrder,
    sections: containers.sectionOrder.map((sectionId) => {
      const section = sectionById.get(sectionId);
      const dragIds = containers.itemsBySection[sectionId] ?? [];

      const items = dragIds
        .map((dragId) => {
          const parsed = parseDragId(dragId);
          if (!parsed || parsed.type !== "item") return null;

          const kind = parsed.kind as CurriculumItem["kind"];
          const existing = section?.items.find((i) => i.id === parsed.id && i.kind === kind);
          if (!existing) return null;

          return {
            kind:
              kind === "exam"
                ? ("exam" as const)
                : kind === "quiz"
                  ? ("quiz" as const)
                  : ("lesson" as const),
            id: parsed.id,
            stepId: "stepId" in existing ? existing.stepId : null,
          };
        })
        .filter(Boolean) as Array<{
        kind: "lesson" | "quiz" | "exam";
        id: string;
        stepId: string | null;
      }>;

      return { sectionId, items };
    }),
  };
}

export function reorderStructureFromContainers(
  structure: CourseStructureModuleItem[],
  containers: CurriculumContainers
): CourseStructureModuleItem[] {
  const sectionById = new Map(structure.map((s) => [s.id, s]));

  return containers.sectionOrder
    .map((sectionId) => {
      const section = sectionById.get(sectionId);
      if (!section) return null;

      const allItems: CurriculumItem[] =
        section.items.length > 0
          ? [...section.items]
          : section.lessons.map((l) => ({ ...l, kind: "lesson" as const }));

      const itemByKey = new Map(allItems.map((i) => [`${i.kind}:${i.id}`, i]));
      const dragIds = containers.itemsBySection[sectionId] ?? [];
      const items = dragIds
        .map((dragId) => {
          const parsed = parseDragId(dragId);
          if (!parsed || parsed.type !== "item") return null;
          return itemByKey.get(`${parsed.kind}:${parsed.id}`) ?? null;
        })
        .filter(Boolean) as CurriculumItem[];

      const lessons = items.filter(
        (i): i is Extract<CurriculumItem, { kind: "lesson" }> => i.kind === "lesson"
      );

      return {
        ...section,
        items,
        lessons: lessons.map((lesson) => ({
          ...lesson,
          moduleId: sectionId,
          sortOrder: lesson.position,
        })),
      };
    })
    .filter(Boolean) as CourseStructureModuleItem[];
}
