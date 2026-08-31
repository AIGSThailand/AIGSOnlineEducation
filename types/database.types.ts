export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "instructor" | "student";
export type CourseStatus = "draft" | "published" | "archived";
export type EnrollmentStatus = "active" | "completed" | "cancelled" | "expired";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          wordpress_user_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          wordpress_user_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          wordpress_user_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      courses: {
        Row: {
          id: string;
          title: string;
          slug: string;
          description: string | null;
          status: CourseStatus;
          thumbnail_url: string | null;
          wordpress_course_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          description?: string | null;
          status?: CourseStatus;
          thumbnail_url?: string | null;
          wordpress_course_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          description?: string | null;
          status?: CourseStatus;
          thumbnail_url?: string | null;
          wordpress_course_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      course_instructors: {
        Row: {
          course_id: string;
          instructor_id: string;
          created_at: string;
        };
        Insert: {
          course_id: string;
          instructor_id: string;
          created_at?: string;
        };
        Update: {
          course_id?: string;
          instructor_id?: string;
          created_at?: string;
        };
      };
      modules: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          title?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      lessons: {
        Row: {
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
        };
        Insert: {
          id?: string;
          module_id?: string | null;
          course_id: string;
          title: string;
          slug: string;
          content?: string | null;
          video_url?: string | null;
          sort_order?: number;
          wordpress_lesson_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string | null;
          course_id?: string;
          title?: string;
          slug?: string;
          content?: string | null;
          video_url?: string | null;
          sort_order?: number;
          wordpress_lesson_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      enrollments: {
        Row: {
          id: string;
          student_id: string;
          course_id: string;
          status: EnrollmentStatus;
          enrolled_at: string;
          completed_at: string | null;
          stripe_subscription_id: string | null;
          wordpress_enrollment_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          course_id: string;
          status?: EnrollmentStatus;
          enrolled_at?: string;
          completed_at?: string | null;
          stripe_subscription_id?: string | null;
          wordpress_enrollment_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          course_id?: string;
          status?: EnrollmentStatus;
          enrolled_at?: string;
          completed_at?: string | null;
          stripe_subscription_id?: string | null;
          wordpress_enrollment_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      lesson_progress: {
        Row: {
          id: string;
          student_id: string;
          course_id: string;
          lesson_id: string;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          course_id: string;
          lesson_id: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          course_id?: string;
          lesson_id?: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string | null;
          status: SubscriptionStatus;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          stripe_price_id?: string | null;
          status?: SubscriptionStatus;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string;
          stripe_price_id?: string | null;
          status?: SubscriptionStatus;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: UserRole;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_instructor: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_assigned_instructor: {
        Args: { course_id: string };
        Returns: boolean;
      };
      is_enrolled_in_course: {
        Args: { course_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
    };
  };
}
