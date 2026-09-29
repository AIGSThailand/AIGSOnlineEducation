"use client";

import { LessonVideo } from "@/components/courses/lesson-video";
import { RichContent } from "@/components/courses/rich-content";
import type { LessonResourceItem } from "@/components/courses/lesson-resources-list";
import {
  LessonSidePanels,
  lessonSidePanelsAvailable,
} from "@/components/player/lesson-side-panels";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type LessonWorkspaceMedia = {
  videoUrl?: string | null;
  title: string;
  posterUrl?: string | null;
  captionsUrl?: string | null;
  transcript?: string | null;
};

interface LessonWorkspaceProps {
  media: LessonWorkspaceMedia;
  contentHtml?: string | null;
  contentFallback?: string;
  resources?: LessonResourceItem[];
  /** When false, only render center column (quiz / locked messages). */
  showMediaChrome?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * Center lesson body: video → title context lives in CoursePlayer header;
 * supplementary HTML + mobile transcript/files tabs under the video.
 * Desktop right rail is rendered by CoursePlayer when panels have content.
 */
export function LessonWorkspace({
  media,
  contentHtml,
  contentFallback = "No supplementary notes for this lesson.",
  resources = [],
  showMediaChrome = true,
  children,
  className,
}: LessonWorkspaceProps) {
  const hasVideo = Boolean(media.videoUrl?.trim());
  const panelsOnMobile = lessonSidePanelsAvailable(media.transcript, resources);

  return (
    <div className={cn("space-y-6", className)}>
      {showMediaChrome && hasVideo ? (
        <LessonVideo
          url={media.videoUrl!.trim()}
          title={media.title}
          posterUrl={media.posterUrl?.trim() || undefined}
          captionsUrl={media.captionsUrl?.trim() || undefined}
        />
      ) : null}

      {children}

      {showMediaChrome ? (
        <RichContent html={contentHtml} fallback={contentFallback} />
      ) : null}

      {showMediaChrome && panelsOnMobile ? (
        <div className="xl:hidden">
          <LessonSidePanels
            transcript={media.transcript}
            resources={resources}
            variant="stack"
          />
        </div>
      ) : null}
    </div>
  );
}

export { lessonSidePanelsAvailable };
