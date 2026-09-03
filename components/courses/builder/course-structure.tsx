"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type CurriculumContainers,
  containersToOrderPayload,
  itemDragId,
  parseDragId,
  reorderStructureFromContainers,
  sectionDragId,
  structureToContainers,
} from "@/features/curriculum/dnd-state";
import type {
  CourseBuilderSelection,
  CourseStructureModuleItem,
  CurriculumItem,
  StructureItemType,
} from "@/features/courses/types";

export type SelectedItem = CourseBuilderSelection;

interface CourseStructureProps {
  structure: CourseStructureModuleItem[];
  selected: SelectedItem;
  onSelect: (item: SelectedItem) => void;
  onAddSection: () => void;
  onAddLesson: (sectionId: string) => void;
  onMoveSection: (sectionId: string, direction: "up" | "down") => void;
  onMoveLesson: (lessonId: string, direction: "up" | "down") => void;
  onDeleteSection: (sectionId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onDuplicateSection?: (sectionId: string) => void;
  onDuplicateLesson?: (sectionId: string, lessonId: string) => void;
  onDuplicateQuiz?: (sectionId: string, quizId: string) => void;
  onReorderSections?: (sectionIds: string[]) => void;
  onReorderCurriculum?: (payload: ReturnType<typeof containersToOrderPayload>) => void;
  expandedSections: Set<string>;
  onToggleSection: (sectionId: string) => void;
  isReordering?: boolean;
}

export function CourseStructure({
  structure,
  selected,
  onSelect,
  onAddSection,
  onAddLesson,
  onMoveSection,
  onMoveLesson,
  onDeleteSection,
  onDeleteLesson,
  onDuplicateSection,
  onDuplicateLesson,
  onDuplicateQuiz,
  onReorderSections,
  onReorderCurriculum,
  expandedSections,
  onToggleSection,
  isReordering,
}: CourseStructureProps) {
  const [containers, setContainersState] = React.useState<CurriculumContainers>(() =>
    structureToContainers(structure)
  );
  const containersRef = React.useRef(containers);
  const setContainers = React.useCallback(
    (next: CurriculumContainers | ((prev: CurriculumContainers) => CurriculumContainers)) => {
      const resolved = typeof next === "function" ? next(containersRef.current) : next;
      containersRef.current = resolved;
      setContainersState(resolved);
    },
    []
  );
  const [localStructure, setLocalStructure] = React.useState(structure);
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const next = structureToContainers(structure);
    containersRef.current = next;
    setContainersState(next);
    setLocalStructure(structure);
  }, [structure]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findSectionForItem = (itemDragKey: string): string | null => {
    for (const [sectionId, ids] of Object.entries(containersRef.current.itemsBySection)) {
      if (ids.includes(itemDragKey as never)) return sectionId;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeParsed = parseDragId(activeId);
    if (!activeParsed || activeParsed.type !== "item") return;

    const activeSection = findSectionForItem(activeId);
    if (!activeSection) return;

    let overSection = findSectionForItem(overId);
    if (!overSection) {
      const overParsed = parseDragId(overId);
      if (overParsed?.type === "section") overSection = overParsed.id;
    }
    if (!overSection || activeSection === overSection) return;

    setContainers((prev) => {
      const activeItems = [...(prev.itemsBySection[activeSection] || [])];
      const overItems = [...(prev.itemsBySection[overSection] || [])];
      const activeIndex = activeItems.indexOf(activeId as never);
      if (activeIndex === -1) return prev;

      activeItems.splice(activeIndex, 1);
      const overIndex = overItems.indexOf(overId as never);
      if (overIndex >= 0) overItems.splice(overIndex, 0, activeId as never);
      else overItems.push(activeId as never);

      return {
        ...prev,
        itemsBySection: {
          ...prev.itemsBySection,
          [activeSection]: activeItems,
          [overSection]: overItems,
        },
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeParsed = parseDragId(activeId);
    const overParsed = parseDragId(overId);

    if (activeParsed?.type === "section") {
      const current = containersRef.current;
      const overSectionId =
        overParsed?.type === "section" ? overParsed.id : findSectionForItem(overId);
      if (!overSectionId) return;

      const oldIndex = current.sectionOrder.indexOf(activeParsed.id);
      const newIndex = current.sectionOrder.indexOf(overSectionId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const nextContainers: CurriculumContainers = {
        ...current,
        sectionOrder: arrayMove(current.sectionOrder, oldIndex, newIndex),
      };
      setContainers(nextContainers);
      setLocalStructure(reorderStructureFromContainers(structure, nextContainers));
      onReorderSections?.(nextContainers.sectionOrder);
      return;
    }

    if (activeParsed?.type !== "item") return;

    const activeSection = findSectionForItem(activeId);
    if (!activeSection) return;

    let overSection = findSectionForItem(overId);
    if (!overSection && overParsed?.type === "section") overSection = overParsed.id;
    if (!overSection) return;

    const current = containersRef.current;
    let nextContainers = current;

    if (activeSection === overSection) {
      const items = [...(current.itemsBySection[activeSection] || [])];
      const oldIndex = items.indexOf(activeId as never);
      const newIndex = items.indexOf(overId as never);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      nextContainers = {
        ...current,
        itemsBySection: {
          ...current.itemsBySection,
          [activeSection]: arrayMove(items, oldIndex, newIndex),
        },
      };
      setContainers(nextContainers);
    }

    setLocalStructure(reorderStructureFromContainers(structure, nextContainers));
    onReorderCurriculum?.(containersToOrderPayload(structure, nextContainers));
  };

  const displayStructure = localStructure.length ? localStructure : structure;
  const activeOverlay = activeDragId ? findOverlayItem(displayStructure, activeDragId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => onSelect({ type: "course" })}
            className={cn(
              "w-full rounded-md px-3 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500",
              selected.type === "course"
                ? "bg-brand-50 text-brand-800"
                : "text-slate-700 hover:bg-slate-50"
            )}
          >
            Course details
          </button>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Curriculum
            </p>
            {isReordering && (
              <p className="text-[10px] text-brand-600" aria-live="polite">
                Saving order…
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAddSection}
            aria-label="Add section"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {displayStructure.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-slate-500">
              <p>No sections yet.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={onAddSection}
              >
                Add section
              </Button>
            </div>
          ) : (
            <SortableContext
              items={containers.sectionOrder.map(sectionDragId)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-1" role="tree" aria-label="Course curriculum">
                {displayStructure.map((section, sIdx) => (
                  <SortableSectionRow
                    key={section.id}
                    section={section}
                    sIdx={sIdx}
                    totalSections={displayStructure.length}
                    selected={selected}
                    expanded={expandedSections.has(section.id)}
                    itemIds={containers.itemsBySection[section.id] ?? []}
                    onSelect={onSelect}
                    onToggleSection={onToggleSection}
                    onAddLesson={onAddLesson}
                    onMoveSection={onMoveSection}
                    onMoveLesson={onMoveLesson}
                    onDeleteSection={onDeleteSection}
                    onDeleteLesson={onDeleteLesson}
                    onDuplicateSection={onDuplicateSection}
                    onDuplicateLesson={onDuplicateLesson}
                    onDuplicateQuiz={onDuplicateQuiz}
                  />
                ))}
              </ul>
            </SortableContext>
          )}
        </div>

        <div className="border-t border-slate-100 p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onAddSection}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add section
          </Button>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeOverlay ? (
          <div className="rounded-md border border-brand-200 bg-white px-3 py-2 text-sm shadow-md">
            {activeOverlay.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function findOverlayItem(structure: CourseStructureModuleItem[], dragId: string) {
  const parsed = parseDragId(dragId);
  if (!parsed) return null;
  if (parsed.type === "section") {
    const section = structure.find((s) => s.id === parsed.id);
    return section ? { title: section.title } : null;
  }
  for (const section of structure) {
    const items =
      section.items.length > 0
        ? section.items
        : section.lessons.map((l) => ({ ...l, kind: "lesson" as const }));
    const item = items.find((i) => i.id === parsed.id && i.kind === parsed.kind);
    if (item) return { title: item.title };
  }
  return null;
}

interface SortableSectionRowProps {
  section: CourseStructureModuleItem;
  sIdx: number;
  totalSections: number;
  selected: SelectedItem;
  expanded: boolean;
  itemIds: string[];
  onSelect: (item: SelectedItem) => void;
  onToggleSection: (sectionId: string) => void;
  onAddLesson: (sectionId: string) => void;
  onMoveSection: (sectionId: string, direction: "up" | "down") => void;
  onMoveLesson: (lessonId: string, direction: "up" | "down") => void;
  onDeleteSection: (sectionId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onDuplicateSection?: (sectionId: string) => void;
  onDuplicateLesson?: (sectionId: string, lessonId: string) => void;
  onDuplicateQuiz?: (sectionId: string, quizId: string) => void;
}

function SortableSectionRow({
  section,
  sIdx,
  totalSections,
  selected,
  expanded,
  itemIds,
  onSelect,
  onToggleSection,
  onAddLesson,
  onMoveSection,
  onMoveLesson,
  onDeleteSection,
  onDeleteLesson,
  onDuplicateSection,
  onDuplicateLesson,
  onDuplicateQuiz,
}: SortableSectionRowProps) {
  const id = sectionDragId(section.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isSectionSelected = selected.type === "section" && selected.id === section.id;
  const items: CurriculumItem[] =
    section.items.length > 0
      ? section.items
      : section.lessons.map((l) => ({ ...l, kind: "lesson" as const }));
  const lessonItems = items.filter((i) => i.kind === "lesson");

  return (
    <li
      ref={setNodeRef}
      style={style}
      role="treeitem"
      aria-expanded={expanded}
      aria-selected={isSectionSelected}
      className={cn(isDragging && "opacity-50")}
    >
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1",
          isSectionSelected ? "bg-brand-50" : "hover:bg-slate-50"
        )}
      >
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 active:cursor-grabbing"
          aria-label={`Drag section ${section.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onToggleSection(section.id)}
          className="rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label={expanded ? "Collapse section" : "Expand section"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => onSelect({ type: "section", id: section.id })}
          className="min-w-0 flex-1 truncate rounded-md px-1 py-2 text-left text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {section.title}
        </button>
        <div className="hidden items-center gap-0.5 group-focus-within:flex group-hover:flex">
          <MoveButtons
            onUp={() => onMoveSection(section.id, "up")}
            onDown={() => onMoveSection(section.id, "down")}
            disableUp={sIdx === 0}
            disableDown={sIdx === totalSections - 1}
            label={`Section ${section.title}`}
          />
          {onDuplicateSection && (
            <IconButton
              label={`Duplicate section ${section.title}`}
              onClick={() => onDuplicateSection(section.id)}
            >
              <Copy className="h-3.5 w-3.5" />
            </IconButton>
          )}
          <IconButton
            label={`Delete section ${section.title}`}
            onClick={() => onDeleteSection(section.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {expanded && (
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <ul className="ml-5 mt-1 space-y-0.5 border-l border-slate-200 pl-2" role="group">
            {items.length === 0 ? (
              <li className="px-2 py-2 text-xs text-slate-500">
                No content yet.{" "}
                <button
                  type="button"
                  className="text-brand-600 underline focus:outline-none focus:ring-2 focus:ring-brand-500"
                  onClick={() => onAddLesson(section.id)}
                >
                  Add lesson
                </button>
              </li>
            ) : (
              items.map((item) => {
                if (item.kind === "lesson") {
                  const lessonIdx = lessonItems.findIndex((l) => l.id === item.id);
                  return (
                    <SortableItemRow
                      key={itemDragId(item)}
                      dragId={itemDragId(item)}
                      item={item}
                      sectionId={section.id}
                      selected={selected}
                      onSelect={onSelect}
                      onMoveUp={() => onMoveLesson(item.id, "up")}
                      onMoveDown={() => onMoveLesson(item.id, "down")}
                      disableUp={lessonIdx <= 0}
                      disableDown={lessonIdx >= lessonItems.length - 1}
                      onDelete={() => onDeleteLesson(item.id)}
                      onDuplicate={
                        onDuplicateLesson ? () => onDuplicateLesson(section.id, item.id) : undefined
                      }
                    />
                  );
                }

                if (item.kind === "quiz" || item.kind === "exam") {
                  return (
                    <SortableItemRow
                      key={itemDragId(item)}
                      dragId={itemDragId(item)}
                      item={item}
                      sectionId={section.id}
                      selected={selected}
                      onSelect={onSelect}
                      onDuplicate={
                        onDuplicateQuiz ? () => onDuplicateQuiz(section.id, item.id) : undefined
                      }
                      isQuiz
                    />
                  );
                }

                return null;
              })
            )}
            <li className="px-1 py-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start text-xs"
                onClick={() => onAddLesson(section.id)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add lesson
              </Button>
            </li>
          </ul>
        </SortableContext>
      )}
    </li>
  );
}

interface SortableItemRowProps {
  dragId: string;
  item: CurriculumItem;
  sectionId: string;
  selected: SelectedItem;
  onSelect: (item: SelectedItem) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
  isQuiz?: boolean;
}

function SortableItemRow({
  dragId,
  item,
  sectionId,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown,
  onDelete,
  onDuplicate,
  isQuiz,
}: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dragId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isLessonSelected = selected.type === "lesson" && selected.id === item.id;
  const isQuizSelected =
    (selected.type === "quiz" || selected.type === "exam") && selected.id === item.id;

  return (
    <li ref={setNodeRef} style={style} className={cn(isDragging && "opacity-50")}>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md",
          isLessonSelected || isQuizSelected ? "bg-brand-50" : "hover:bg-slate-50"
        )}
      >
        <button
          type="button"
          className="cursor-grab touch-none rounded p-0.5 text-slate-300 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 active:cursor-grabbing"
          aria-label={`Drag ${item.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (item.kind === "lesson") {
              onSelect({ type: "lesson", id: item.id, sectionId });
            } else {
              onSelect({
                type: item.kind === "exam" ? "exam" : "quiz",
                id: item.id,
                sectionId,
              });
            }
          }}
          className={cn(
            "min-w-0 flex-1 truncate rounded-md px-1 py-1.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-brand-500",
            isQuiz ? "flex items-center gap-2 text-slate-600" : "text-slate-700"
          )}
        >
          {isQuiz && <ClipboardList className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />}
          <span className="truncate">{item.title}</span>
          {isQuiz && <span className="ml-auto text-[10px] uppercase text-slate-400">Quiz</span>}
        </button>
        <div className="hidden items-center gap-0.5 group-focus-within:flex group-hover:flex">
          {onMoveUp && onMoveDown && (
            <MoveButtons
              onUp={onMoveUp}
              onDown={onMoveDown}
              disableUp={disableUp}
              disableDown={disableDown}
              label={item.title}
            />
          )}
          {onDuplicate && (
            <IconButton label={`Duplicate ${item.title}`} onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5" />
            </IconButton>
          )}
          {onDelete && (
            <IconButton label={`Delete ${item.title}`} onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </div>
      </div>
    </li>
  );
}

function MoveButtons({
  onUp,
  onDown,
  disableUp,
  disableDown,
  label,
}: {
  onUp: () => void;
  onDown: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
  label: string;
}) {
  return (
    <>
      <IconButton label={`Move ${label} up`} onClick={onUp} disabled={disableUp}>
        <ChevronUp className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label={`Move ${label} down`} onClick={onDown} disabled={disableDown}>
        <ChevronDown className="h-3.5 w-3.5" />
      </IconButton>
    </>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function itemTypeLabel(type: StructureItemType): string {
  switch (type) {
    case "section":
    case "module":
      return "Section";
    case "lesson":
      return "Lesson";
    case "quiz":
    case "exam":
      return "Quiz";
    default:
      return "Item";
  }
}
