"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  value: LessonMediaFields;
  onChange: (patch: Partial<LessonMediaFields>) => void;
  disabled?: boolean;
}

export function LessonMediaEditor({ value, onChange, disabled }: LessonMediaEditorProps) {
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Primary video</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Provider metadata for Phase 1. Playback still uses the video URL.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="lesson-video-provider">Provider</Label>
          <Select
            id="lesson-video-provider"
            value={value.videoProvider}
            disabled={disabled}
            onChange={(e) =>
              onChange({ videoProvider: e.target.value as VideoProvider })
            }
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
        <div className="sm:col-span-2">
          <Label htmlFor="lesson-video-url">Video URL</Label>
          <Input
            id="lesson-video-url"
            type="url"
            placeholder="https://…"
            value={value.videoUrl}
            disabled={disabled}
            onChange={(e) => onChange({ videoUrl: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="lesson-video-id">Video ID</Label>
          <Input
            id="lesson-video-id"
            value={value.videoId}
            disabled={disabled}
            onChange={(e) => onChange({ videoId: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="lesson-video-thumb">Thumbnail URL</Label>
          <Input
            id="lesson-video-thumb"
            type="url"
            value={value.videoThumbnailUrl}
            disabled={disabled}
            onChange={(e) => onChange({ videoThumbnailUrl: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="lesson-video-captions">Captions URL</Label>
          <Input
            id="lesson-video-captions"
            type="url"
            value={value.videoCaptionsUrl}
            disabled={disabled}
            onChange={(e) => onChange({ videoCaptionsUrl: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="lesson-video-transcript">Transcript</Label>
          <Textarea
            id="lesson-video-transcript"
            rows={4}
            value={value.videoTranscript}
            disabled={disabled}
            onChange={(e) => onChange({ videoTranscript: e.target.value })}
          />
        </div>
      </div>
    </section>
  );
}
