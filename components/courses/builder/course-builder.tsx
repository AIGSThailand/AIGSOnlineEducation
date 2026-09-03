"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { BuilderHeader } from "./builder-header";
import { CourseStructure, type SelectedItem } from "./course-structure";
import { ContentEditor } from "./content-editor";
import { CourseSettings } from "./course-settings";
import { PublishDialog } from "./publish-dialog";
import { ArchiveDialog } from "./archive-dialog";
import { DeleteItemDialog } from "./delete-item-dialog";
import {
  createLessonAction,
  createModuleAction,
  deleteLessonAction,
  deleteModuleAction,
  duplicateLessonAction,
  duplicateQuizAction,
  duplicateSectionAction,
  reorderCurriculumAction,
  reorderLessonAction,
  reorderModuleAction,
  reorderSectionsAction,
} from "@/features/courses/builder/actions";
import type {
  BuilderPortal,
  CourseBuilderData,
  CourseBuilderSelection,
  SaveStatus,
} from "@/features/courses/types";
import { builderSelectionToSearchParams } from "@/features/courses/types";
import { slugifyTitle } from "@/features/courses/builder/ordering";

interface CourseBuilderProps {
  portal: BuilderPortal;
  data: CourseBuilderData;
  isAdmin: boolean;
  initialSelection?: CourseBuilderSelection;
}

export function CourseBuilder({
  portal,
  data,
  isAdmin,
  initialSelection = { type: "course" },
}: CourseBuilderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<SelectedItem>(initialSelection);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveSignal, setSaveSignal] = useState(0);
  const [structureOpen, setStructureOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: "section"; id: string } | { kind: "lesson"; id: string } | null
  >(null);
  const [isReordering, setIsReordering] = useState(false);

  const expandedDefaults = useMemo(() => {
    const set = new Set(data.structure.map((s) => s.id));
    if (selected.type === "lesson" && selected.sectionId) set.add(selected.sectionId);
    if (selected.type === "quiz" && selected.sectionId) set.add(selected.sectionId);
    if (selected.type === "exam" && selected.sectionId) set.add(selected.sectionId);
    if (selected.type === "section") set.add(selected.id);
    return set;
  }, [data.structure, selected]);

  const [expanded, setExpanded] = useState<Set<string>>(expandedDefaults);

  useEffect(() => {
    setSelected(initialSelection);
  }, [initialSelection]);

  const syncSelectionToUrl = useCallback(
    (item: SelectedItem) => {
      const params = builderSelectionToSearchParams(item);
      const qs = params.toString();
      const next = qs ? `${pathname}?${qs}` : pathname;
      router.replace(next, { scroll: false });
    },
    [pathname, router]
  );

  const handleSelect = useCallback(
    (item: SelectedItem) => {
      setSelected(item);
      syncSelectionToUrl(item);
    },
    [syncSelectionToUrl]
  );

  const toggleSection = (sectionId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const handleAddSection = () => {
    startTransition(async () => {
      const result = await createModuleAction({
        courseId: data.course.id,
        title: `Section ${data.structure.length + 1}`,
      });
      if (result.success && result.data) {
        handleSelect({ type: "section", id: result.data.moduleId });
        setExpanded((prev) => new Set(prev).add(result.data!.moduleId));
        router.refresh();
      }
    });
  };

  const handleAddLesson = (sectionId: string) => {
    const section = data.structure.find((s) => s.id === sectionId);
    const lessonCount =
      section?.items.filter((i) => i.kind === "lesson").length ?? section?.lessons.length ?? 0;
    const title = `Lesson ${lessonCount + 1}`;
    startTransition(async () => {
      const result = await createLessonAction({
        courseId: data.course.id,
        moduleId: sectionId,
        title,
        slug: slugifyTitle(`${title}-${Date.now()}`),
        status: "draft",
      });
      if (result.success && result.data) {
        handleSelect({ type: "lesson", id: result.data.lessonId, sectionId });
        setExpanded((prev) => new Set(prev).add(sectionId));
        router.refresh();
      }
    });
  };

  const handleMoveSection = (sectionId: string, direction: "up" | "down") => {
    startTransition(async () => {
      await reorderModuleAction({ courseId: data.course.id, moduleId: sectionId, direction });
      router.refresh();
    });
  };

  const handleMoveLesson = (lessonId: string, direction: "up" | "down") => {
    startTransition(async () => {
      await reorderLessonAction({ courseId: data.course.id, lessonId, direction });
      router.refresh();
    });
  };

  const handleReorderSections = (sectionIds: string[]) => {
    setIsReordering(true);
    startTransition(async () => {
      const result = await reorderSectionsAction({ courseId: data.course.id, sectionIds });
      setIsReordering(false);
      if (result.success) router.refresh();
    });
  };

  const handleReorderCurriculum = (payload: {
    sectionIds: string[];
    sections: Array<{
      sectionId: string;
      items: Array<{ kind: "lesson" | "quiz" | "exam"; id: string; stepId: string | null }>;
    }>;
  }) => {
    setIsReordering(true);
    startTransition(async () => {
      const result = await reorderCurriculumAction({
        courseId: data.course.id,
        sections: payload.sections.map((s) => ({
          sectionId: s.sectionId,
          items: s.items.map(({ kind, id }) => ({ kind, id })),
        })),
      });
      setIsReordering(false);
      if (result.success) router.refresh();
    });
  };

  const handleDuplicateSection = (sectionId: string) => {
    startTransition(async () => {
      const result = await duplicateSectionAction({ courseId: data.course.id, sectionId });
      if (result.success && result.data) {
        handleSelect({ type: "section", id: result.data.sectionId });
        setExpanded((prev) => new Set(prev).add(result.data!.sectionId));
        router.refresh();
      }
    });
  };

  const handleDuplicateLesson = (sectionId: string, lessonId: string) => {
    startTransition(async () => {
      const result = await duplicateLessonAction({
        courseId: data.course.id,
        sectionId,
        lessonId,
      });
      if (result.success && result.data) {
        handleSelect({ type: "lesson", id: result.data.lessonId, sectionId });
        router.refresh();
      }
    });
  };

  const handleDuplicateQuiz = (sectionId: string, quizId: string) => {
    startTransition(async () => {
      const result = await duplicateQuizAction({
        courseId: data.course.id,
        sectionId,
        quizId,
      });
      if (result.success && result.data) {
        handleSelect({ type: "quiz", id: result.data.quizId, sectionId });
        router.refresh();
      }
    });
  };

  const triggerSave = useCallback(() => {
    setSaveSignal((n) => n + 1);
  }, []);

  const structureProps = {
    structure: data.structure,
    selected,
    onSelect: handleSelect,
    onAddSection: handleAddSection,
    onAddLesson: handleAddLesson,
    onMoveSection: handleMoveSection,
    onMoveLesson: handleMoveLesson,
    onDeleteSection: (id: string) => setDeleteTarget({ kind: "section", id }),
    onDeleteLesson: (id: string) => setDeleteTarget({ kind: "lesson", id }),
    onDuplicateSection: handleDuplicateSection,
    onDuplicateLesson: handleDuplicateLesson,
    onDuplicateQuiz: handleDuplicateQuiz,
    onReorderSections: handleReorderSections,
    onReorderCurriculum: handleReorderCurriculum,
    expandedSections: expanded,
    onToggleSection: toggleSection,
    isReordering,
  };

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col bg-slate-50">
      <BuilderHeader
        portal={portal}
        course={data.course}
        saveStatus={saveStatus}
        structureSource={data.structureSource}
        onPublish={() => setPublishOpen(true)}
        onArchive={() => setArchiveOpen(true)}
        onSave={triggerSave}
        onOpenStructure={() => setStructureOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        canPublish={data.permissions.canPublish}
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
          <CourseStructure {...structureProps} />
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-3xl">
            <ContentEditor
              data={data}
              selected={selected}
              onSaveStatusChange={setSaveStatus}
              saveSignal={saveSignal}
            />
          </div>
        </main>

        <aside className="hidden w-80 shrink-0 border-l border-slate-200 bg-white xl:block">
          <div className="h-full overflow-y-auto p-6">
            <CourseSettings
              course={data.course}
              instructors={data.instructors}
              isAdmin={isAdmin}
              permissions={data.permissions}
              onSaveStatusChange={setSaveStatus}
            />
          </div>
        </aside>
      </div>

      <Sheet open={structureOpen} onOpenChange={setStructureOpen} title="Curriculum">
        <CourseStructure
          {...structureProps}
          onSelect={(item) => {
            handleSelect(item);
            setStructureOpen(false);
          }}
        />
      </Sheet>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen} title="Settings" side="right">
        <CourseSettings
          course={data.course}
          instructors={data.instructors}
          isAdmin={isAdmin}
          permissions={data.permissions}
          onSaveStatusChange={setSaveStatus}
        />
      </Sheet>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} courseId={data.course.id} />
      <ArchiveDialog open={archiveOpen} onOpenChange={setArchiveOpen} courseId={data.course.id} />

      <DeleteItemDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.kind === "section" ? "Remove section" : "Remove lesson"}
        description={
          deleteTarget?.kind === "section"
            ? "This will remove the section and its lessons. Lessons with student progress cannot be deleted."
            : "This lesson will be permanently removed if no student progress exists."
        }
        onConfirm={async () => {
          if (!deleteTarget) return { success: false, error: "No target." };
          if (deleteTarget.kind === "section") {
            const result = await deleteModuleAction({
              courseId: data.course.id,
              moduleId: deleteTarget.id,
            });
            if (result.success) handleSelect({ type: "course" });
            return result;
          }
          const result = await deleteLessonAction({
            courseId: data.course.id,
            lessonId: deleteTarget.id,
          });
          if (result.success) handleSelect({ type: "course" });
          return result;
        }}
      />
    </div>
  );
}
