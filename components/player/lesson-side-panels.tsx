"use client";

import { useState } from "react";
import { FileText, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LessonResourcesList,
  type LessonResourceItem,
} from "@/components/courses/lesson-resources-list";

export type LessonSidePanelTab = "transcript" | "files";

interface LessonSidePanelsProps {
  transcript?: string | null;
  resources?: LessonResourceItem[];
  /** Desktop right rail vs mobile/tablet under-video panels */
  variant?: "rail" | "stack";
  className?: string;
  defaultTab?: LessonSidePanelTab;
}

function hasTranscript(transcript?: string | null): boolean {
  return Boolean(transcript?.trim());
}

function hasFiles(resources?: LessonResourceItem[]): boolean {
  return Boolean(resources && resources.length > 0);
}

/** Returns true when at least one side panel has content. */
export function lessonSidePanelsAvailable(
  transcript?: string | null,
  resources?: LessonResourceItem[]
): boolean {
  return hasTranscript(transcript) || hasFiles(resources);
}

export function LessonSidePanels({
  transcript,
  resources = [],
  variant = "rail",
  className,
  defaultTab,
}: LessonSidePanelsProps) {
  const showTranscript = hasTranscript(transcript);
  const showFiles = hasFiles(resources);
  const initial: LessonSidePanelTab =
    defaultTab ?? (showTranscript ? "transcript" : "files");
  const [tab, setTab] = useState<LessonSidePanelTab>(initial);

  if (!showTranscript && !showFiles) return null;

  const active: LessonSidePanelTab =
    tab === "transcript" && !showTranscript
      ? "files"
      : tab === "files" && !showFiles
        ? "transcript"
        : tab;

  const tabs: { id: LessonSidePanelTab; label: string; icon: typeof FileText }[] = [];
  if (showTranscript) tabs.push({ id: "transcript", label: "Transcript", icon: FileText });
  if (showFiles) tabs.push({ id: "files", label: "Files", icon: FolderOpen });

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col border-[var(--border)] bg-[var(--surface)]",
        variant === "rail" && "h-full border-l",
        variant === "stack" && "rounded-xl border",
        className
      )}
      aria-label="Lesson tools"
    >
      {tabs.length > 1 ? (
        <div
          className={cn(
            "flex shrink-0 gap-1 border-b border-[var(--border)] p-2",
            variant === "rail" && "flex-col xl:flex-row"
          )}
          role="tablist"
          aria-label="Lesson side panels"
        >
          {tabs.map(({ id, label, icon: Icon }) => {
            const selected = active === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                id={`lesson-panel-tab-${id}`}
                onClick={() => setTab(id)}
                className={cn(
                  "inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors",
                  selected
                    ? "bg-[var(--brand-primary-muted)] text-[var(--brand-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            {tabs[0]?.label}
          </p>
        </div>
      )}

      <div
        role="tabpanel"
        aria-labelledby={tabs.length > 1 ? `lesson-panel-tab-${active}` : undefined}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
      >
        {active === "transcript" && showTranscript ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
            {transcript!.trim()}
          </div>
        ) : null}
        {active === "files" && showFiles ? (
          <LessonResourcesList
            resources={resources}
            className="border-0 bg-transparent p-0"
          />
        ) : null}
      </div>
    </aside>
  );
}
