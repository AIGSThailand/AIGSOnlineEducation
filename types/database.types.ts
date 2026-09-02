export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "instructor" | "student";
export type CourseStatus = "draft" | "published" | "archived";
export type ContentStatus = "draft" | "published" | "archived";
export type CourseProgressionType = "linear" | "free_form";
export type CourseStepType = "lesson" | "topic" | "quiz";
export type EnrollmentStatus = "active" | "completed" | "cancelled" | "expired";
export type EnrollmentSource = "manual" | "stripe" | "migration" | "group" | "admin";
export type GroupStatus = "active" | "archived";
export type CertificateRuleSourceType = "course" | "quiz" | "group";
export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "fill_blank"
  | "essay"
  | "assessment";
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
          excerpt: string | null;
          status: CourseStatus;
          progression_type: CourseProgressionType;
          thumbnail_url: string | null;
          stripe_product_id: string | null;
          stripe_price_id: string | null;
          wordpress_course_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          description?: string | null;
          excerpt?: string | null;
          status?: CourseStatus;
          progression_type?: CourseProgressionType;
          thumbnail_url?: string | null;
          stripe_product_id?: string | null;
          stripe_price_id?: string | null;
          wordpress_course_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          description?: string | null;
          excerpt?: string | null;
          status?: CourseStatus;
          progression_type?: CourseProgressionType;
          thumbnail_url?: string | null;
          stripe_product_id?: string | null;
          stripe_price_id?: string | null;
          wordpress_course_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      course_sections: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          description: string | null;
          sort_order: number;
          wordpress_section_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          description?: string | null;
          sort_order?: number;
          wordpress_section_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          title?: string;
          description?: string | null;
          sort_order?: number;
          wordpress_section_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      course_steps: {
        Row: {
          id: string;
          course_id: string;
          step_type: CourseStepType;
          lesson_id: string | null;
          topic_id: string | null;
          quiz_id: string | null;
          parent_step_id: string | null;
          section_id: string | null;
          sort_order: number;
          is_required: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          step_type: CourseStepType;
          lesson_id?: string | null;
          topic_id?: string | null;
          quiz_id?: string | null;
          parent_step_id?: string | null;
          section_id?: string | null;
          sort_order?: number;
          is_required?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          step_type?: CourseStepType;
          lesson_id?: string | null;
          topic_id?: string | null;
          quiz_id?: string | null;
          parent_step_id?: string | null;
          section_id?: string | null;
          sort_order?: number;
          is_required?: boolean;
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
          excerpt: string | null;
          video_url: string | null;
          status: ContentStatus;
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
          excerpt?: string | null;
          video_url?: string | null;
          status?: ContentStatus;
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
          excerpt?: string | null;
          video_url?: string | null;
          status?: ContentStatus;
          sort_order?: number;
          wordpress_lesson_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      topics: {
        Row: {
          id: string;
          title: string;
          slug: string;
          content: string | null;
          excerpt: string | null;
          video_url: string | null;
          status: ContentStatus;
          wordpress_topic_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          content?: string | null;
          excerpt?: string | null;
          video_url?: string | null;
          status?: ContentStatus;
          wordpress_topic_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          content?: string | null;
          excerpt?: string | null;
          video_url?: string | null;
          status?: ContentStatus;
          wordpress_topic_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      quizzes: {
        Row: {
          id: string;
          title: string;
          slug: string;
          description: string | null;
          status: ContentStatus;
          passing_percentage: number;
          time_limit_seconds: number | null;
          max_attempts: number | null;
          require_all_questions: boolean;
          randomize_questions: boolean;
          wordpress_quiz_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          description?: string | null;
          status?: ContentStatus;
          passing_percentage?: number;
          time_limit_seconds?: number | null;
          max_attempts?: number | null;
          require_all_questions?: boolean;
          randomize_questions?: boolean;
          wordpress_quiz_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          description?: string | null;
          status?: ContentStatus;
          passing_percentage?: number;
          time_limit_seconds?: number | null;
          max_attempts?: number | null;
          require_all_questions?: boolean;
          randomize_questions?: boolean;
          wordpress_quiz_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      questions: {
        Row: {
          id: string;
          title: string | null;
          question_text: string;
          question_type: QuestionType;
          default_points: number;
          explanation: string | null;
          wordpress_question_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title?: string | null;
          question_text: string;
          question_type: QuestionType;
          default_points?: number;
          explanation?: string | null;
          wordpress_question_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string | null;
          question_text?: string;
          question_type?: QuestionType;
          default_points?: number;
          explanation?: string | null;
          wordpress_question_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      question_options: {
        Row: {
          id: string;
          question_id: string;
          answer_text: string;
          is_correct: boolean;
          sort_order: number;
          feedback: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          answer_text: string;
          is_correct?: boolean;
          sort_order?: number;
          feedback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          answer_text?: string;
          is_correct?: boolean;
          sort_order?: number;
          feedback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      quiz_questions: {
        Row: {
          id: string;
          quiz_id: string;
          question_id: string;
          sort_order: number;
          points_override: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          question_id: string;
          sort_order?: number;
          points_override?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          question_id?: string;
          sort_order?: number;
          points_override?: number | null;
          created_at?: string;
        };
      };
      quiz_attempts: {
        Row: {
          id: string;
          quiz_id: string;
          student_id: string;
          course_id: string;
          started_at: string;
          submitted_at: string | null;
          attempt_number: number;
          score: number | null;
          percentage: number | null;
          points_earned: number | null;
          points_possible: number | null;
          passed: boolean | null;
          time_spent_seconds: number | null;
          wordpress_attempt_ref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          student_id: string;
          course_id: string;
          started_at?: string;
          submitted_at?: string | null;
          attempt_number?: number;
          score?: number | null;
          percentage?: number | null;
          points_earned?: number | null;
          points_possible?: number | null;
          passed?: boolean | null;
          time_spent_seconds?: number | null;
          wordpress_attempt_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          student_id?: string;
          course_id?: string;
          started_at?: string;
          submitted_at?: string | null;
          attempt_number?: number;
          score?: number | null;
          percentage?: number | null;
          points_earned?: number | null;
          points_possible?: number | null;
          passed?: boolean | null;
          time_spent_seconds?: number | null;
          wordpress_attempt_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      quiz_attempt_answers: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          answer_data: Json;
          is_correct: boolean | null;
          points_awarded: number | null;
          needs_review: boolean;
          instructor_feedback: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          answer_data?: Json;
          is_correct?: boolean | null;
          points_awarded?: number | null;
          needs_review?: boolean;
          instructor_feedback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          attempt_id?: string;
          question_id?: string;
          answer_data?: Json;
          is_correct?: boolean | null;
          points_awarded?: number | null;
          needs_review?: boolean;
          instructor_feedback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      groups: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          status: GroupStatus;
          wordpress_group_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          status?: GroupStatus;
          wordpress_group_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          status?: GroupStatus;
          wordpress_group_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      group_users: {
        Row: {
          group_id: string;
          user_id: string;
          joined_at: string;
          created_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          joined_at?: string;
          created_at?: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
          joined_at?: string;
          created_at?: string;
        };
      };
      group_leaders: {
        Row: {
          group_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      group_courses: {
        Row: {
          group_id: string;
          course_id: string;
          created_at: string;
        };
        Insert: {
          group_id: string;
          course_id: string;
          created_at?: string;
        };
        Update: {
          group_id?: string;
          course_id?: string;
          created_at?: string;
        };
      };
      certificate_templates: {
        Row: {
          id: string;
          title: string;
          slug: string;
          description: string | null;
          template_data: Json;
          wordpress_certificate_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          description?: string | null;
          template_data?: Json;
          wordpress_certificate_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          description?: string | null;
          template_data?: Json;
          wordpress_certificate_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      certificate_rules: {
        Row: {
          id: string;
          certificate_template_id: string;
          source_type: CertificateRuleSourceType;
          course_id: string | null;
          quiz_id: string | null;
          group_id: string | null;
          minimum_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          certificate_template_id: string;
          source_type: CertificateRuleSourceType;
          course_id?: string | null;
          quiz_id?: string | null;
          group_id?: string | null;
          minimum_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          certificate_template_id?: string;
          source_type?: CertificateRuleSourceType;
          course_id?: string | null;
          quiz_id?: string | null;
          group_id?: string | null;
          minimum_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      earned_certificates: {
        Row: {
          id: string;
          certificate_template_id: string;
          student_id: string;
          course_id: string | null;
          quiz_id: string | null;
          group_id: string | null;
          earned_at: string;
          verification_code: string;
          pdf_url: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          certificate_template_id: string;
          student_id: string;
          course_id?: string | null;
          quiz_id?: string | null;
          group_id?: string | null;
          earned_at?: string;
          verification_code: string;
          pdf_url?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          certificate_template_id?: string;
          student_id?: string;
          course_id?: string | null;
          quiz_id?: string | null;
          group_id?: string | null;
          earned_at?: string;
          verification_code?: string;
          pdf_url?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      enrollments: {
        Row: {
          id: string;
          student_id: string;
          course_id: string;
          status: EnrollmentStatus;
          enrollment_source: EnrollmentSource;
          source_reference: string | null;
          enrolled_at: string;
          completed_at: string | null;
          stripe_subscription_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_checkout_session_id: string | null;
          wordpress_enrollment_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          course_id: string;
          status?: EnrollmentStatus;
          enrollment_source?: EnrollmentSource;
          source_reference?: string | null;
          enrolled_at?: string;
          completed_at?: string | null;
          stripe_subscription_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_checkout_session_id?: string | null;
          wordpress_enrollment_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          course_id?: string;
          status?: EnrollmentStatus;
          enrollment_source?: EnrollmentSource;
          source_reference?: string | null;
          enrolled_at?: string;
          completed_at?: string | null;
          stripe_subscription_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_checkout_session_id?: string | null;
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
      topic_progress: {
        Row: {
          id: string;
          student_id: string;
          course_id: string;
          topic_id: string;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          course_id: string;
          topic_id: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          course_id?: string;
          topic_id?: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      step_progress: {
        Row: {
          id: string;
          student_id: string;
          course_id: string;
          course_step_id: string;
          completed: boolean;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          course_id: string;
          course_step_id: string;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          course_id?: string;
          course_step_id?: string;
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
          stripe_product_id: string | null;
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
          stripe_product_id?: string | null;
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
          stripe_product_id?: string | null;
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
      is_group_member: {
        Args: { p_group_id: string };
        Returns: boolean;
      };
      is_group_leader: {
        Args: { p_group_id: string };
        Returns: boolean;
      };
      can_manage_group: {
        Args: { p_group_id: string };
        Returns: boolean;
      };
      has_group_course_access: {
        Args: { p_course_id: string };
        Returns: boolean;
      };
      can_access_course_content: {
        Args: { p_course_id: string };
        Returns: boolean;
      };
      course_id_for_step: {
        Args: { p_step_id: string };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      enrollment_source: EnrollmentSource;
      course_progression_type: CourseProgressionType;
      content_status: ContentStatus;
      course_step_type: CourseStepType;
      certificate_rule_source_type: CertificateRuleSourceType;
      group_status: GroupStatus;
    };
  };
}
