"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  completionTypeSchema,
  dripTypeSchema,
} from "@/features/lessons/schema";
import type { z } from "zod";

type CompletionType = z.infer<typeof completionTypeSchema>;
type DripType = z.infer<typeof dripTypeSchema>;

export type LessonLearningFields = {
  estimatedDurationMinutes: string;
  isRequired: boolean;
  completionType: CompletionType;
  videoWatchPercentage: string;
  dripType: DripType;
  dripDays: string;
  dripFixedDate: string;
  status: "draft" | "published" | "archived";
  featuredImageUrl: string;
};

interface LessonLearningSettingsProps {
  value: LessonLearningFields;
  onChange: (patch: Partial<LessonLearningFields>) => void;
  onFeaturedUpload?: (file: File) => Promise<void>;
  onFeaturedRemove?: () => void;
  featuredBusy?: boolean;
  disabled?: boolean;
}

export function LessonLearningSettings({
  value,
  onChange,
  onFeaturedUpload,
  onFeaturedRemove,
  featuredBusy,
  disabled,
}: LessonLearningSettingsProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Publishing
        </h3>
        <div>
          <Label htmlFor="lesson-status">Status</Label>
          <Select
            id="lesson-status"
            value={value.status}
            disabled={disabled}
            onChange={(e) =>
              onChange({ status: e.target.value as LessonLearningFields["status"] })
            }
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="lesson-featured">Featured image URL</Label>
          <Input
            id="lesson-featured"
            type="url"
            value={value.featuredImageUrl}
            disabled={disabled}
            onChange={(e) => onChange({ featuredImageUrl: e.target.value })}
          />
          {value.featuredImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.featuredImageUrl}
              alt=""
              className="mt-2 h-24 w-full rounded-md object-cover"
            />
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {onFeaturedUpload && (
              <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                Upload
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={disabled || featuredBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void onFeaturedUpload(file);
                  }}
                />
              </label>
            )}
            {value.featuredImageUrl && onFeaturedRemove && (
              <button
                type="button"
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                disabled={disabled}
                onClick={onFeaturedRemove}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Learning
        </h3>
        <div>
          <Label htmlFor="lesson-duration">Estimated duration (minutes)</Label>
          <Input
            id="lesson-duration"
            type="number"
            min={0}
            value={value.estimatedDurationMinutes}
            disabled={disabled}
            onChange={(e) => onChange({ estimatedDurationMinutes: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={value.isRequired}
            disabled={disabled}
            onChange={(e) => onChange({ isRequired: e.target.checked })}
          />
          Required lesson
        </label>
        <div>
          <Label htmlFor="lesson-completion">Completion type</Label>
          <Select
            id="lesson-completion"
            value={value.completionType}
            disabled={disabled}
            onChange={(e) =>
              onChange({ completionType: e.target.value as CompletionType })
            }
          >
            <option value="manual">Manual</option>
            <option value="content_view">Content view</option>
            <option value="video_watch">Video watch</option>
            <option value="quiz_pass">Quiz pass</option>
            <option value="assignment_submit">Assignment submit</option>
            <option value="automatic">Automatic</option>
          </Select>
        </div>
        {value.completionType === "video_watch" && (
          <div>
            <Label htmlFor="lesson-watch-pct">Video watch %</Label>
            <Input
              id="lesson-watch-pct"
              type="number"
              min={1}
              max={100}
              value={value.videoWatchPercentage}
              disabled={disabled}
              onChange={(e) => onChange({ videoWatchPercentage: e.target.value })}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Access / Drip
        </h3>
        <div>
          <Label htmlFor="lesson-drip">Availability</Label>
          <Select
            id="lesson-drip"
            value={value.dripType}
            disabled={disabled}
            onChange={(e) => onChange({ dripType: e.target.value as DripType })}
          >
            <option value="immediate">Immediate</option>
            <option value="days_after_enrollment">Days after enrollment</option>
            <option value="fixed_date">Fixed date</option>
            <option value="prerequisite">Prerequisite</option>
          </Select>
        </div>
        {value.dripType === "days_after_enrollment" && (
          <div>
            <Label htmlFor="lesson-drip-days">Days after enrollment</Label>
            <Input
              id="lesson-drip-days"
              type="number"
              min={0}
              value={value.dripDays}
              disabled={disabled}
              onChange={(e) => onChange({ dripDays: e.target.value })}
            />
          </div>
        )}
        {value.dripType === "fixed_date" && (
          <div>
            <Label htmlFor="lesson-drip-date">Available on</Label>
            <Input
              id="lesson-drip-date"
              type="date"
              value={value.dripFixedDate}
              disabled={disabled}
              onChange={(e) => onChange({ dripFixedDate: e.target.value })}
            />
          </div>
        )}
        <p className="text-xs text-slate-400">
          Drip rules are stored for future enforcement; runtime drip is not active yet.
        </p>
      </section>
    </div>
  );
}
