export type PlayerStepKind = "lesson" | "quiz";

export interface PlayerStep {
  key: string;
  kind: PlayerStepKind;
  contentId: string;
  stepId: string | null;
  sectionId: string;
  title: string;
  href: string;
  nested: boolean;
}

export interface PlayerItem extends PlayerStep {
  children: PlayerStep[];
}

export interface PlayerSection {
  id: string;
  title: string;
  items: PlayerItem[];
}

export interface CoursePlayerData {
  courseId: string;
  courseTitle: string;
  progressionType: "linear" | "free_form";
  sections: PlayerSection[];
  flatSteps: PlayerStep[];
  completedKeys: string[];
}

export type StepRow = {
  id: string;
  course_id: string;
  step_type: "lesson" | "topic" | "quiz";
  lesson_id: string | null;
  quiz_id: string | null;
  section_id: string | null;
  parent_step_id: string | null;
  sort_order: number;
};
