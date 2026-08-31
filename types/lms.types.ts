import type { CourseStatus, EnrollmentStatus } from "./database.types";

export interface CourseWithInstructors {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: CourseStatus;
  thumbnail_url: string | null;
  wordpress_course_id: number | null;
  created_at: string;
  updated_at: string;
  instructors?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  }[];
}

export interface ModuleWithLessons {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  lessons: LessonSummary[];
}

export interface LessonSummary {
  id: string;
  module_id: string | null;
  course_id: string;
  title: string;
  slug: string;
  sort_order: number;
  is_completed?: boolean;
}

export interface FullLesson {
  id: string;
  module_id: string | null;
  course_id: string;
  title: string;
  slug: string;
  content: string | null;
  video_url: string | null;
  sort_order: number;
  wordpress_lesson_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentDetail {
  id: string;
  student_id: string;
  course_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at: string | null;
  course?: CourseWithInstructors;
}
