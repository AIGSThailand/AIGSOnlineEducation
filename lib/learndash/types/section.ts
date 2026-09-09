import type { LearnDashEntityId } from "./common";

/**
 * LearnDash course builder section heading (`course_sections` post meta).
 * Not a CPT — headings only. `order` is the absolute builder position among
 * top-level items (section headings + lessons share one sequence).
 */
export type LearnDashSectionHeading = {
  title: string;
  /** 1-based absolute position in the course builder list. */
  order: number;
  /** Synthetic ID from LD JSON when present. */
  wordpressSectionId: LearnDashEntityId | null;
  /**
   * When LD returns enriched sections (e.g. via sections REST), lesson/quiz
   * post IDs that belong under this heading.
   */
  stepIds?: LearnDashEntityId[];
};
