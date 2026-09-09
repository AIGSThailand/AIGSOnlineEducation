/**
 * Offline checks for curriculum DnD helpers (incl. cross-section moves).
 * Run: npx tsx scripts/test-curriculum-dnd.ts
 */
import {
  containersToOrderPayload,
  itemDragId,
  reorderStructureFromContainers,
  structureToContainers,
} from "../features/curriculum/dnd-state";
import type { CourseStructureModuleItem } from "../features/courses/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const structure: CourseStructureModuleItem[] = [
  {
    kind: "section",
    id: "sec-a",
    title: "第一课",
    description: null,
    position: 0,
    wordpressSectionId: null,
    sortOrder: 0,
    items: [
      {
        kind: "lesson",
        id: "l1",
        stepId: "s1",
        sectionId: "sec-a",
        title: "Lesson 1",
        slug: "l1",
        position: 0,
        status: "published",
        hasProgress: false,
      },
      {
        kind: "lesson",
        id: "l2",
        stepId: "s2",
        sectionId: "sec-a",
        title: "Lesson 2",
        slug: "l2",
        position: 1,
        status: "published",
        hasProgress: false,
      },
    ],
    lessons: [],
  },
  {
    kind: "section",
    id: "sec-b",
    title: "第二课",
    description: null,
    position: 1,
    wordpressSectionId: null,
    sortOrder: 1,
    items: [
      {
        kind: "lesson",
        id: "l3",
        stepId: "s3",
        sectionId: "sec-b",
        title: "Lesson 3",
        slug: "l3",
        position: 0,
        status: "published",
        hasProgress: false,
      },
    ],
    lessons: [],
  },
];

// Sync deprecated lessons arrays
for (const section of structure) {
  section.lessons = section.items.filter((i) => i.kind === "lesson") as typeof section.lessons;
}

const containers = structureToContainers(structure);
const l2 = itemDragId({ kind: "lesson", id: "l2" });

// Move l2 from sec-a → sec-b (before l3)
containers.itemsBySection["sec-a"] = containers.itemsBySection["sec-a"].filter((id) => id !== l2);
containers.itemsBySection["sec-b"] = [l2, ...containers.itemsBySection["sec-b"]];

const payload = containersToOrderPayload(structure, containers);
assert(payload.sections[0].items.map((i) => i.id).join(",") === "l1", "sec-a keeps l1");
assert(payload.sections[1].items.map((i) => i.id).join(",") === "l2,l3", "sec-b has l2,l3");

const next = reorderStructureFromContainers(structure, containers);
assert(next[0].items.map((i) => i.id).join(",") === "l1", "UI sec-a");
assert(next[1].items.map((i) => i.id).join(",") === "l2,l3", "UI sec-b");
assert(next[1].items[0].sectionId === "sec-b", "moved lesson sectionId updated");
assert(next[1].items[0].title === "Lesson 2", "moved lesson title preserved");

console.log("test:curriculum-dnd OK");
