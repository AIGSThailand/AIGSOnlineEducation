/** LearnDash WordPress post ID. */
export type LearnDashEntityId = number;

export type LearnDashPostStatus = string;

export type LearnDashPostType =
  | "sfwd-courses"
  | "sfwd-lessons"
  | "sfwd-topic"
  | "sfwd-quiz"
  | "sfwd-question"
  | "sfwd-assignment"
  | "sfwd-essays"
  | "groups"
  | string;

export type LearnDashRenderedField = {
  raw?: string;
  rendered?: string;
  protected?: boolean;
};

export type LearnDashWpEntity = {
  id: LearnDashEntityId;
  date?: string;
  date_gmt?: string;
  modified?: string;
  modified_gmt?: string;
  slug?: string;
  status?: LearnDashPostStatus;
  type?: LearnDashPostType;
  link?: string;
  title?: LearnDashRenderedField | string;
  content?: LearnDashRenderedField | string;
  excerpt?: LearnDashRenderedField | string;
  author?: number;
  featured_media?: number;
  /** Plugin-specific fields preserved as unknown. */
  [key: string]: unknown;
};

export function getRenderedText(field: LearnDashRenderedField | string | undefined): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field.rendered || field.raw || "";
}
