"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MediaUploader } from "@/components/media/media-uploader";
import { LessonVideo } from "@/components/courses/lesson-video";
import { classifyVideoUrl } from "@/lib/utils/video-embed";
import type { videoProviderSchema } from "@/features/lessons/schema";
import type { z } from "zod";

type VideoProvider = z.infer<typeof videoProviderSchema> | "";

export type LessonMediaFields = {
  videoProvider: VideoProvider;
  videoUrl: string;
  videoId: string;
  videoDurationSeconds: string;
  videoThumbnailUrl: string;
  videoTranscript: string;
  videoCaptionsUrl: string;
};

interface LessonMediaEditorProps {
  courseId: string;
  value: LessonMediaFields;
  onChange: (patch: Partial<LessonMediaFields>) => void;
  disabled?: boolean;
}

function inferProvider(url: string): VideoProvider {
  const kind = classifyVideoUrl(url);
  if (kind === "youtube") return "youtube";
  if (kind === "vimeo") return "vimeo";
  if (kind === "file") return "self_hosted";
  if (kind === "iframe") return "external";
  return "";
}

export function LessonMediaEditor({
  courseId,
  value,
  onChange,
  disabled,
}: LessonMediaEditorProps) {
  const captionsHint =
    value.videoCaptionsUrl && !/\.vtt(\?|#|$)/i.test(value.videoCaptionsUrl)
      ? "Prefer WebVTT (.vtt). Other formats may not work in all browsers."
      : "Upload a .vtt file or paste a stable captions URL (not a signed link).";

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Primary video</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Managed separately from lesson HTML. Upload self-hosted media or paste a YouTube / Vimeo /
          provider URL. Store only permanent URLs (CDN or /api/media/file), never expiring signed
          links.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="lesson-video-provider">Provider</Label>
          <Select
            id="lesson-video-provider"
            value={value.videoProvider}
            disabled={disabled}
            onChange={(e) => onChange({ videoProvider: e.target.value as VideoProvider })}
          >
            <option value="">Not set</option>
            <option value="youtube">YouTube</option>
            <option value="vimeo">Vimeo</option>
            <option value="bunny">Bunny</option>
            <option value="cloudflare">Cloudflare</option>
            <option value="self_hosted">Self-hosted</option>
            <option value="external">External</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="lesson-video-duration">Duration (seconds)</Label>
          <Input
            id="lesson-video-duration"
            type="number"
            min={1}
            placeholder="Optional"
            value={value.videoDurationSeconds}
            disabled={disabled}
            onChange={(e) => onChange({ videoDurationSeconds: e.target.value })}
          />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="lesson-video-url">Video URL</Label>
          <MediaUploader
            courseId={courseId}
            kind="lesson-video"
            className="mb-1"
            disabled={disabled}
            label="Upload video file"
            onUploaded={(url) =>
              onChange({
                videoUrl: url,
                videoProvider: value.videoProvider || "self_hosted",
              })
            }
          />
          <Input
            id="lesson-video-url"
            type="url"
            placeholder="https://… or /api/media/file?key=…"
            value={value.videoUrl}
            disabled={disabled}
            onChange={(e) => {
              const videoUrl = e.target.value;
              const inferred = inferProvider(videoUrl);
              onChange({
                videoUrl,
                ...(inferred && !value.videoProvider ? { videoProvider: inferred } : {}),
              });
            }}
          />
        </div>

        <div>
          <Label htmlFor="lesson-video-id">Video ID</Label>
          <Input
            id="lesson-video-id"
            value={value.videoId}
            disabled={disabled}
            placeholder="Optional provider id"
            onChange={(e) => onChange({ videoId: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lesson-video-thumb">Thumbnail</Label>
          <MediaUploader
            courseId={courseId}
            kind="thumbnail"
            disabled={disabled}
            label="Upload thumbnail"
            onUploaded={(url) => onChange({ videoThumbnailUrl: url })}
          />
          <Input
            id="lesson-video-thumb"
            type="url"
            value={value.videoThumbnailUrl}
            disabled={disabled}
            placeholder="https://… or /api/media/file?key=…"
            onChange={(e) => onChange({ videoThumbnailUrl: e.target.value })}
          />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="lesson-video-captions">Captions (WebVTT)</Label>
          <MediaUploader
            courseId={courseId}
            kind="caption"
            disabled={disabled}
            label="Upload .vtt captions"
            onUploaded={(url) => onChange({ videoCaptionsUrl: url })}
          />
          <Input
            id="lesson-video-captions"
            type="url"
            value={value.videoCaptionsUrl}
            disabled={disabled}
            placeholder="https://….vtt or /api/media/file?key=…"
            onChange={(e) => onChange({ videoCaptionsUrl: e.target.value })}
          />
          <p className="text-xs text-slate-500">{captionsHint}</p>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="lesson-video-transcript">Transcript (plain text)</Label>
          <Textarea
            id="lesson-video-transcript"
            rows={5}
            value={value.videoTranscript}
            disabled={disabled}
            placeholder="Shown in the learner Transcript panel. Timestamped sync needs WebVTT cues (later phase)."
            onChange={(e) => onChange({ videoTranscript: e.target.value })}
          />
        </div>
      </div>

      {value.videoUrl.trim() ? (
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Playback preview
          </p>
          <LessonVideo
            url={value.videoUrl.trim()}
            title="Lesson video preview"
            posterUrl={value.videoThumbnailUrl.trim() || undefined}
            captionsUrl={value.videoCaptionsUrl.trim() || undefined}
          />
        </div>
      ) : null}
    </section>
  );
}
