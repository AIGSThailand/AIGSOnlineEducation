"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  reorderLessonAction,
  reorderModuleAction,
} from "@/features/courses/builder/actions";
import type { BuilderPortal, CourseBuilderData, SaveStatus } from "@/features/courses/types";
import { slugifyTitle } from "@/features/courses/builder/ordering";

interface CourseBuilderProps {
  portal: BuilderPortal;
  data: CourseBuilderData;
  isAdmin: boolean;
}

export function CourseBuilder({ portal, data, isAdmin }: CourseBuilderProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<SelectedItem>({ type: "course" });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveSignal, setSaveSignal] = useState(0);
  const [structureOpen, setStructureOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: "module"; id: string } | { kind: "lesson"; id: string } | null
  >(null);

  const expandedModules = useMemo(() => {
    const set = new Set(data.structure.map((m) => m.id));
    if (selected.type === "lesson") set.add(selected.moduleId);
    if (selected.type === "module") set.add(selected.id);
    return set;
  }, [data.structure, selected]);

  const [expanded, setExpanded] = useState<Set<string>>(expandedModules);

  const toggleModule = (moduleId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const handleAddModule = () => {
    startTransition(async () => {
      const result = await createModuleAction({
        courseId: data.course.id,
        title: `Module ${data.structure.length + 1}`,
      });
      if (result.success && result.data) {
        setSelected({ type: "module", id: result.data.moduleId });
        setExpanded((prev) => new Set(prev).add(result.data!.moduleId));
        router.refresh();
      }
    });
  };

  const handleAddLesson = (moduleId: string) => {
    const mod = data.structure.find((m) => m.id === moduleId);
    const lessonNum = (mod?.lessons.length ?? 0) + 1;
    const title = `Lesson ${lessonNum}`;
    startTransition(async () => {
      const result = await createLessonAction({
        courseId: data.course.id,
        moduleId,
        title,
        slug: slugifyTitle(`${title}-${Date.now()}`),
        status: "draft",
      });
      if (result.success && result.data) {
        setSelected({ type: "lesson", id: result.data.lessonId, moduleId });
        setExpanded((prev) => new Set(prev).add(moduleId));
        router.refresh();
      }
    });
  };

  const handleMoveModule = (moduleId: string, direction: "up" | "down") => {
    startTransition(async () => {
      await reorderModuleAction({ courseId: data.course.id, moduleId, direction });
      router.refresh();
    });
  };

  const handleMoveLesson = (lessonId: string, direction: "up" | "down") => {
    startTransition(async () => {
      await reorderLessonAction({ courseId: data.course.id, lessonId, direction });
      router.refresh();
    });
  };

  const triggerSave = useCallback(() => {
    setSaveSignal((n) => n + 1);
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-65px)] flex-col bg-slate-50">
      <BuilderHeader
        portal={portal}
        course={data.course}
        saveStatus={saveStatus}
        onPublish={() => setPublishOpen(true)}
        onArchive={() => setArchiveOpen(true)}
        onSave={triggerSave}
        onOpenStructure={() => setStructureOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Structure panel — desktop */}
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
          <CourseStructure
            structure={data.structure}
            selected={selected}
            onSelect={setSelected}
            onAddModule={handleAddModule}
            onAddLesson={handleAddLesson}
            onMoveModule={handleMoveModule}
            onMoveLesson={handleMoveLesson}
            onDeleteModule={(id) => setDeleteTarget({ kind: "module", id })}
            onDeleteLesson={(id) => setDeleteTarget({ kind: "lesson", id })}
            expandedModules={expanded}
            onToggleModule={toggleModule}
          />
        </aside>

        {/* Main editor */}
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

        {/* Settings panel — desktop */}
        <aside className="hidden w-80 shrink-0 border-l border-slate-200 bg-white xl:block">
          <div className="h-full overflow-y-auto p-6">
            <CourseSettings
              course={data.course}
              instructors={data.instructors}
              isAdmin={isAdmin}
              onSaveStatusChange={setSaveStatus}
            />
          </div>
        </aside>
      </div>

      <Sheet open={structureOpen} onOpenChange={setStructureOpen} title="Course structure">
        <CourseStructure
          structure={data.structure}
          selected={selected}
          onSelect={(item) => {
            setSelected(item);
            setStructureOpen(false);
          }}
          onAddModule={handleAddModule}
          onAddLesson={handleAddLesson}
          onMoveModule={handleMoveModule}
          onMoveLesson={handleMoveLesson}
          onDeleteModule={(id) => setDeleteTarget({ kind: "module", id })}
          onDeleteLesson={(id) => setDeleteTarget({ kind: "lesson", id })}
          expandedModules={expanded}
          onToggleModule={toggleModule}
        />
      </Sheet>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen} title="Settings" side="right">
        <CourseSettings
          course={data.course}
          instructors={data.instructors}
          isAdmin={isAdmin}
          onSaveStatusChange={setSaveStatus}
        />
      </Sheet>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        courseId={data.course.id}
      />
      <ArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        courseId={data.course.id}
      />

      <DeleteItemDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.kind === "module" ? "Remove module" : "Remove lesson"}
        description={
          deleteTarget?.kind === "module"
            ? "This will remove the module and its lessons. Lessons with student progress cannot be deleted."
            : "This lesson will be permanently removed if no student progress exists."
        }
        onConfirm={async () => {
          if (!deleteTarget) return { success: false, error: "No target." };
          if (deleteTarget.kind === "module") {
            const result = await deleteModuleAction({
              courseId: data.course.id,
              moduleId: deleteTarget.id,
            });
            if (result.success) setSelected({ type: "course" });
            return result;
          }
          const result = await deleteLessonAction({
            courseId: data.course.id,
            lessonId: deleteTarget.id,
          });
          if (result.success) setSelected({ type: "course" });
          return result;
        }}
      />
    </div>
  );
}
