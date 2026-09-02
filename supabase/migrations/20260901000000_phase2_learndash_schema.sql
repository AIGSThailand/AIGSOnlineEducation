-- ==============================================================================
-- AIGS Online Education — Phase 2 LearnDash-Compatible Schema
-- Migration: 20260901000000_phase2_learndash_schema.sql
--
-- SAFE EVOLUTION of Phase 1 schema:
-- - Does NOT modify 20260831000000_initial_schema.sql
-- - Additive columns and new tables only
-- - Backfills course_sections + course_steps from existing modules/lessons
-- - Preserves all wordpress_* legacy identifiers
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. New enum types
-- ------------------------------------------------------------------------------
CREATE TYPE public.enrollment_source AS ENUM (
    'manual',
    'stripe',
    'migration',
    'group',
    'admin'
);

CREATE TYPE public.course_progression_type AS ENUM (
    'linear',
    'free_form'
);

CREATE TYPE public.content_status AS ENUM (
    'draft',
    'published',
    'archived'
);

CREATE TYPE public.course_step_type AS ENUM (
    'lesson',
    'topic',
    'quiz'
);

CREATE TYPE public.certificate_rule_source_type AS ENUM (
    'course',
    'quiz',
    'group'
);

CREATE TYPE public.group_status AS ENUM (
    'active',
    'archived'
);

-- Question types: TEXT + CHECK (extensible for LearnDash compatibility)

-- ------------------------------------------------------------------------------
-- 2. Alter existing Phase 1 tables (additive only)
-- ------------------------------------------------------------------------------
ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS excerpt TEXT,
    ADD COLUMN IF NOT EXISTS progression_type public.course_progression_type NOT NULL DEFAULT 'free_form',
    ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

CREATE INDEX IF NOT EXISTS idx_courses_stripe_product ON public.courses(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_courses_stripe_price ON public.courses(stripe_price_id);

ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS excerpt TEXT,
    ADD COLUMN IF NOT EXISTS status public.content_status NOT NULL DEFAULT 'published';

CREATE INDEX IF NOT EXISTS idx_lessons_status ON public.lessons(status);

ALTER TABLE public.enrollments
    ADD COLUMN IF NOT EXISTS enrollment_source public.enrollment_source NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS source_reference TEXT,
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_enrollments_source ON public.enrollments(enrollment_source);
CREATE INDEX IF NOT EXISTS idx_enrollments_stripe_pi ON public.enrollments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_stripe_cs ON public.enrollments(stripe_checkout_session_id);

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_product ON public.subscriptions(stripe_product_id);

-- ------------------------------------------------------------------------------
-- 3. Course sections
-- ------------------------------------------------------------------------------
CREATE TABLE public.course_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    wordpress_section_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_course_section_order UNIQUE (course_id, sort_order)
);

CREATE INDEX idx_course_sections_course ON public.course_sections(course_id, sort_order);
CREATE INDEX idx_course_sections_wp_id ON public.course_sections(wordpress_section_id)
    WHERE wordpress_section_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 4. Topics
-- ------------------------------------------------------------------------------
CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT,
    excerpt TEXT,
    video_url TEXT,
    status public.content_status NOT NULL DEFAULT 'published',
    wordpress_topic_id BIGINT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_topics_slug UNIQUE (slug)
);

CREATE INDEX idx_topics_wp_id ON public.topics(wordpress_topic_id);
CREATE INDEX idx_topics_status ON public.topics(status);

-- ------------------------------------------------------------------------------
-- 5. Quizzes
-- ------------------------------------------------------------------------------
CREATE TABLE public.quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    status public.content_status NOT NULL DEFAULT 'published',
    passing_percentage NUMERIC(5,2) NOT NULL DEFAULT 80.00
        CHECK (passing_percentage >= 0 AND passing_percentage <= 100),
    time_limit_seconds INTEGER CHECK (time_limit_seconds IS NULL OR time_limit_seconds > 0),
    max_attempts INTEGER CHECK (max_attempts IS NULL OR max_attempts > 0),
    require_all_questions BOOLEAN NOT NULL DEFAULT false,
    randomize_questions BOOLEAN NOT NULL DEFAULT false,
    wordpress_quiz_id BIGINT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_quizzes_slug UNIQUE (slug)
);

CREATE INDEX idx_quizzes_wp_id ON public.quizzes(wordpress_quiz_id);
CREATE INDEX idx_quizzes_status ON public.quizzes(status);

-- ------------------------------------------------------------------------------
-- 6. Course steps (typed FKs + CHECK — not unsafe polymorphic step_id)
-- ------------------------------------------------------------------------------
CREATE TABLE public.course_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    step_type public.course_step_type NOT NULL,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE RESTRICT,
    topic_id UUID REFERENCES public.topics(id) ON DELETE RESTRICT,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE RESTRICT,
    parent_step_id UUID REFERENCES public.course_steps(id) ON DELETE CASCADE,
    section_id UUID REFERENCES public.course_sections(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT course_steps_content_fk_check CHECK (
        (step_type = 'lesson' AND lesson_id IS NOT NULL AND topic_id IS NULL AND quiz_id IS NULL)
        OR (step_type = 'topic' AND topic_id IS NOT NULL AND lesson_id IS NULL AND quiz_id IS NULL)
        OR (step_type = 'quiz' AND quiz_id IS NOT NULL AND lesson_id IS NULL AND topic_id IS NULL)
    )
);

CREATE UNIQUE INDEX uq_course_step_order
    ON public.course_steps(
        course_id,
        COALESCE(parent_step_id, '00000000-0000-0000-0000-000000000000'::uuid),
        sort_order
    );

CREATE INDEX idx_course_steps_course ON public.course_steps(course_id, sort_order);
CREATE INDEX idx_course_steps_parent ON public.course_steps(parent_step_id);
CREATE INDEX idx_course_steps_section ON public.course_steps(section_id);
CREATE INDEX idx_course_steps_lesson ON public.course_steps(lesson_id) WHERE lesson_id IS NOT NULL;
CREATE INDEX idx_course_steps_topic ON public.course_steps(topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX idx_course_steps_quiz ON public.course_steps(quiz_id) WHERE quiz_id IS NOT NULL;

CREATE UNIQUE INDEX uq_course_steps_lesson_placement
    ON public.course_steps(course_id, lesson_id, COALESCE(parent_step_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE lesson_id IS NOT NULL;

CREATE UNIQUE INDEX uq_course_steps_topic_placement
    ON public.course_steps(course_id, topic_id, COALESCE(parent_step_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE topic_id IS NOT NULL;

CREATE UNIQUE INDEX uq_course_steps_quiz_placement
    ON public.course_steps(course_id, quiz_id, COALESCE(parent_step_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE quiz_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 7. Questions & quiz composition
-- ------------------------------------------------------------------------------
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL
        CHECK (question_type IN (
            'single_choice', 'multiple_choice', 'true_false',
            'fill_blank', 'essay', 'assessment'
        )),
    default_points NUMERIC(8,2) NOT NULL DEFAULT 1.00 CHECK (default_points >= 0),
    explanation TEXT,
    wordpress_question_id BIGINT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_questions_type ON public.questions(question_type);
CREATE INDEX idx_questions_wp_id ON public.questions(wordpress_question_id);

CREATE TABLE public.question_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_question_option_order UNIQUE (question_id, sort_order)
);

CREATE INDEX idx_question_options_question ON public.question_options(question_id, sort_order);

CREATE TABLE public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    points_override NUMERIC(8,2) CHECK (points_override IS NULL OR points_override >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_quiz_question_order UNIQUE (quiz_id, sort_order),
    CONSTRAINT uq_quiz_question_pair UNIQUE (quiz_id, question_id)
);

CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions(quiz_id, sort_order);
CREATE INDEX idx_quiz_questions_question ON public.quiz_questions(question_id);

-- ------------------------------------------------------------------------------
-- 8. Quiz attempts & answers
-- ------------------------------------------------------------------------------
CREATE TABLE public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    submitted_at TIMESTAMPTZ,
    attempt_number INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
    score NUMERIC(10,2),
    percentage NUMERIC(5,2) CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
    points_earned NUMERIC(10,2),
    points_possible NUMERIC(10,2),
    passed BOOLEAN,
    time_spent_seconds INTEGER CHECK (time_spent_seconds IS NULL OR time_spent_seconds >= 0),
    wordpress_attempt_ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_quiz_attempt_number UNIQUE (quiz_id, student_id, course_id, attempt_number)
);

CREATE INDEX idx_quiz_attempts_student ON public.quiz_attempts(student_id, submitted_at DESC);
CREATE INDEX idx_quiz_attempts_quiz ON public.quiz_attempts(quiz_id, submitted_at DESC);
CREATE INDEX idx_quiz_attempts_course ON public.quiz_attempts(course_id, submitted_at DESC);

CREATE TABLE public.quiz_attempt_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
    answer_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_correct BOOLEAN,
    points_awarded NUMERIC(8,2),
    needs_review BOOLEAN NOT NULL DEFAULT false,
    instructor_feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
);

CREATE INDEX idx_quiz_attempt_answers_attempt ON public.quiz_attempt_answers(attempt_id);

-- answer_data JSON formats:
-- single_choice:   { "selected_option_id": "uuid" }
-- multiple_choice: { "selected_option_ids": ["uuid"] }
-- true_false:      { "value": true }
-- fill_blank:      { "blanks": ["text"] }
-- essay:           { "text": "response" }
-- assessment:      { "value": "payload" }

-- ------------------------------------------------------------------------------
-- 9. Groups (before certificate_rules group FK)
-- ------------------------------------------------------------------------------
CREATE TABLE public.groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    status public.group_status NOT NULL DEFAULT 'active',
    wordpress_group_id BIGINT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_groups_slug UNIQUE (slug)
);

CREATE INDEX idx_groups_wp_id ON public.groups(wordpress_group_id);
CREATE INDEX idx_groups_status ON public.groups(status);

CREATE TABLE public.group_users (
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_users_user ON public.group_users(user_id);

CREATE TABLE public.group_leaders (
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_leaders_user ON public.group_leaders(user_id);

CREATE TABLE public.group_courses (
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (group_id, course_id)
);

CREATE INDEX idx_group_courses_course ON public.group_courses(course_id);

-- ------------------------------------------------------------------------------
-- 10. Certificates
-- ------------------------------------------------------------------------------
CREATE TABLE public.certificate_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    wordpress_certificate_id BIGINT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_certificate_templates_slug UNIQUE (slug)
);

CREATE INDEX idx_certificate_templates_wp_id ON public.certificate_templates(wordpress_certificate_id);

CREATE TABLE public.certificate_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_template_id UUID NOT NULL REFERENCES public.certificate_templates(id) ON DELETE CASCADE,
    source_type public.certificate_rule_source_type NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    minimum_score NUMERIC(5,2) CHECK (minimum_score IS NULL OR (minimum_score >= 0 AND minimum_score <= 100)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT certificate_rules_source_fk_check CHECK (
        (source_type = 'course' AND course_id IS NOT NULL AND quiz_id IS NULL AND group_id IS NULL)
        OR (source_type = 'quiz' AND quiz_id IS NOT NULL AND course_id IS NULL AND group_id IS NULL)
        OR (source_type = 'group' AND group_id IS NOT NULL AND course_id IS NULL AND quiz_id IS NULL)
    )
);

CREATE INDEX idx_certificate_rules_template ON public.certificate_rules(certificate_template_id);
CREATE INDEX idx_certificate_rules_course ON public.certificate_rules(course_id) WHERE course_id IS NOT NULL;
CREATE INDEX idx_certificate_rules_quiz ON public.certificate_rules(quiz_id) WHERE quiz_id IS NOT NULL;
CREATE INDEX idx_certificate_rules_group ON public.certificate_rules(group_id) WHERE group_id IS NOT NULL;

CREATE TABLE public.earned_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_template_id UUID NOT NULL REFERENCES public.certificate_templates(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    verification_code TEXT NOT NULL UNIQUE,
    pdf_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT earned_certificates_source_check CHECK (
        course_id IS NOT NULL OR quiz_id IS NOT NULL OR group_id IS NOT NULL
    )
);

CREATE INDEX idx_earned_certificates_student ON public.earned_certificates(student_id, earned_at DESC);
CREATE INDEX idx_earned_certificates_template ON public.earned_certificates(certificate_template_id);
CREATE INDEX idx_earned_certificates_verification ON public.earned_certificates(verification_code);

-- ------------------------------------------------------------------------------
-- 11. Progress (complement lesson_progress — do not drop Phase 1 table)
-- ------------------------------------------------------------------------------
CREATE TABLE public.topic_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_student_topic_progress UNIQUE (student_id, course_id, topic_id)
);

CREATE INDEX idx_topic_progress_student ON public.topic_progress(student_id, course_id);

CREATE TABLE public.step_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    course_step_id UUID NOT NULL REFERENCES public.course_steps(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_student_step_progress UNIQUE (student_id, course_step_id)
);

CREATE INDEX idx_step_progress_student ON public.step_progress(student_id, course_id);
CREATE INDEX idx_step_progress_step ON public.step_progress(course_step_id);

-- ------------------------------------------------------------------------------
-- 12. Updated_at triggers for new tables
-- ------------------------------------------------------------------------------
CREATE TRIGGER tr_course_sections_updated_at
    BEFORE UPDATE ON public.course_sections
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER tr_topics_updated_at
    BEFORE UPDATE ON public.topics
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER tr_quizzes_updated_at
    BEFORE UPDATE ON public.quizzes
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER tr_course_steps_updated_at
    BEFORE UPDATE ON public.course_steps
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER tr_questions_updated_at
    BEFORE UPDATE ON public.questions
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER tr_question_options_updated_at
    BEFORE UPDATE ON public.question_options
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER tr_quiz_attempts_updated_at
    BEFORE UPDATE ON public.quiz_attempts
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER tr_quiz_attempt_answers_updated_at
    BEFORE UPDATE ON public.quiz_attempt_answers
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER tr_groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER tr_certificate_templates_updated_at
    BEFORE UPDATE ON public.certificate_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER tr_certificate_rules_updated_at
    BEFORE UPDATE ON public.certificate_rules
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER tr_topic_progress_updated_at
    BEFORE UPDATE ON public.topic_progress
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER tr_step_progress_updated_at
    BEFORE UPDATE ON public.step_progress
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ------------------------------------------------------------------------------
-- 13. Security helper functions (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_users
        WHERE group_id = p_group_id AND user_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_group_leader(p_group_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_leaders
        WHERE group_id = p_group_id AND user_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_manage_group(p_group_id UUID)
RETURNS BOOLEAN AS $$
    SELECT public.is_admin() OR public.is_group_leader(p_group_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_group_course_access(p_course_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.group_courses gc
        JOIN public.group_users gu ON gu.group_id = gc.group_id
        WHERE gc.course_id = p_course_id
          AND gu.user_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_access_course_content(p_course_id UUID)
RETURNS BOOLEAN AS $$
    SELECT
        public.is_admin()
        OR public.is_assigned_instructor(p_course_id)
        OR public.is_enrolled_in_course(p_course_id)
        OR public.has_group_course_access(p_course_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.course_id_for_step(p_step_id UUID)
RETURNS UUID AS $$
    SELECT course_id FROM public.course_steps WHERE id = p_step_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 14. Backfill Phase 1 data into Phase 2 structures
-- ------------------------------------------------------------------------------

-- Copy modules → course_sections (preserve UUIDs for seamless transition)
INSERT INTO public.course_sections (id, course_id, title, sort_order, created_at, updated_at)
SELECT id, course_id, title, sort_order, created_at, updated_at
FROM public.modules
ON CONFLICT (id) DO NOTHING;

-- Create course_steps from existing lessons (one step per lesson, top-level)
INSERT INTO public.course_steps (
    course_id, step_type, lesson_id, section_id, sort_order, is_required, created_at, updated_at
)
SELECT
    l.course_id,
    'lesson'::public.course_step_type,
    l.id,
    l.module_id,
    l.sort_order,
    true,
    l.created_at,
    l.updated_at
FROM public.lessons l
WHERE NOT EXISTS (
    SELECT 1 FROM public.course_steps cs
    WHERE cs.course_id = l.course_id AND cs.lesson_id = l.id
);

-- Backfill step_progress from existing lesson_progress where course_steps exist
INSERT INTO public.step_progress (student_id, course_id, course_step_id, completed, completed_at, created_at, updated_at)
SELECT
    lp.student_id,
    lp.course_id,
    cs.id,
    lp.completed,
    lp.completed_at,
    lp.created_at,
    lp.updated_at
FROM public.lesson_progress lp
JOIN public.course_steps cs ON cs.lesson_id = lp.lesson_id AND cs.course_id = lp.course_id
ON CONFLICT (student_id, course_step_id) DO NOTHING;

-- Mark migrated enrollments from LearnDash import
UPDATE public.enrollments
SET enrollment_source = 'migration'::public.enrollment_source
WHERE wordpress_enrollment_id IS NOT NULL
  AND enrollment_source = 'manual'::public.enrollment_source;

-- ------------------------------------------------------------------------------
-- 15. Row Level Security
-- ------------------------------------------------------------------------------
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earned_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_progress ENABLE ROW LEVEL SECURITY;

-- Course sections
CREATE POLICY "course_sections_select" ON public.course_sections FOR SELECT USING (
    public.is_admin()
    OR public.is_assigned_instructor(course_id)
    OR public.can_access_course_content(course_id)
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_sections.course_id AND c.status = 'published')
);

CREATE POLICY "course_sections_write" ON public.course_sections FOR ALL USING (
    public.is_admin() OR public.is_assigned_instructor(course_id)
);

-- Course steps
CREATE POLICY "course_steps_select" ON public.course_steps FOR SELECT USING (
    public.is_admin()
    OR public.is_assigned_instructor(course_id)
    OR public.can_access_course_content(course_id)
    OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_steps.course_id AND c.status = 'published')
);

CREATE POLICY "course_steps_write" ON public.course_steps FOR ALL USING (
    public.is_admin() OR public.is_assigned_instructor(course_id)
);

-- Topics (content readable when used in accessible course)
CREATE POLICY "topics_select" ON public.topics FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.course_steps cs
        WHERE cs.topic_id = topics.id
          AND (public.can_access_course_content(cs.course_id)
               OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = cs.course_id AND c.status = 'published'))
    )
);

CREATE POLICY "topics_write" ON public.topics FOR ALL USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.course_steps cs
        WHERE cs.topic_id = topics.id AND public.is_assigned_instructor(cs.course_id)
    )
);

-- Quizzes
CREATE POLICY "quizzes_select" ON public.quizzes FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.course_steps cs
        WHERE cs.quiz_id = quizzes.id
          AND (public.can_access_course_content(cs.course_id)
               OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = cs.course_id AND c.status = 'published'))
    )
);

CREATE POLICY "quizzes_write" ON public.quizzes FOR ALL USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.course_steps cs
        WHERE cs.quiz_id = quizzes.id AND public.is_assigned_instructor(cs.course_id)
    )
);

-- Questions & options (via quiz access)
CREATE POLICY "questions_select" ON public.questions FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.quiz_questions qq
        JOIN public.course_steps cs ON cs.quiz_id = qq.quiz_id
        WHERE qq.question_id = questions.id
          AND public.can_access_course_content(cs.course_id)
    )
);

CREATE POLICY "questions_write" ON public.questions FOR ALL USING (
    public.is_admin()
);

CREATE POLICY "question_options_select" ON public.question_options FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.quiz_questions qq
        JOIN public.course_steps cs ON cs.quiz_id = qq.quiz_id
        WHERE qq.question_id = question_options.question_id
          AND public.can_access_course_content(cs.course_id)
    )
);

CREATE POLICY "question_options_write" ON public.question_options FOR ALL USING (
    public.is_admin()
);

CREATE POLICY "quiz_questions_select" ON public.quiz_questions FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.course_steps cs
        WHERE cs.quiz_id = quiz_questions.quiz_id
          AND public.can_access_course_content(cs.course_id)
    )
);

CREATE POLICY "quiz_questions_write" ON public.quiz_questions FOR ALL USING (
    public.is_admin()
);

-- Quiz attempts (students own; instructors assigned courses)
CREATE POLICY "quiz_attempts_select" ON public.quiz_attempts FOR SELECT USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_assigned_instructor(course_id)
    OR (public.is_group_leader((SELECT gc.group_id FROM public.group_courses gc WHERE gc.course_id = quiz_attempts.course_id LIMIT 1)))
);

CREATE POLICY "quiz_attempts_insert" ON public.quiz_attempts FOR INSERT WITH CHECK (
    student_id = auth.uid() AND public.can_access_course_content(course_id)
);

CREATE POLICY "quiz_attempts_update" ON public.quiz_attempts FOR UPDATE USING (
    student_id = auth.uid() OR public.is_admin() OR public.is_assigned_instructor(course_id)
);

-- Quiz attempt answers
CREATE POLICY "quiz_attempt_answers_select" ON public.quiz_attempt_answers FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.quiz_attempts qa
        WHERE qa.id = quiz_attempt_answers.attempt_id
          AND (qa.student_id = auth.uid() OR public.is_admin() OR public.is_assigned_instructor(qa.course_id))
    )
);

CREATE POLICY "quiz_attempt_answers_manage" ON public.quiz_attempt_answers FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.quiz_attempts qa
        WHERE qa.id = quiz_attempt_answers.attempt_id
          AND (qa.student_id = auth.uid() OR public.is_admin() OR public.is_assigned_instructor(qa.course_id))
    )
);

-- Groups
CREATE POLICY "groups_select" ON public.groups FOR SELECT USING (
    public.is_admin()
    OR public.is_group_member(id)
    OR public.is_group_leader(id)
);

CREATE POLICY "groups_manage" ON public.groups FOR ALL USING (
    public.is_admin()
);

CREATE POLICY "group_users_select" ON public.group_users FOR SELECT USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR public.can_manage_group(group_id)
);

CREATE POLICY "group_users_manage" ON public.group_users FOR ALL USING (
    public.is_admin() OR public.can_manage_group(group_id)
);

CREATE POLICY "group_leaders_select" ON public.group_leaders FOR SELECT USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR public.is_group_member(group_id)
);

CREATE POLICY "group_leaders_manage" ON public.group_leaders FOR ALL USING (
    public.is_admin() OR public.can_manage_group(group_id)
);

CREATE POLICY "group_courses_select" ON public.group_courses FOR SELECT USING (
    public.is_admin()
    OR public.is_group_member(group_id)
    OR public.is_group_leader(group_id)
    OR public.is_assigned_instructor(course_id)
);

CREATE POLICY "group_courses_manage" ON public.group_courses FOR ALL USING (
    public.is_admin() OR public.can_manage_group(group_id)
);

-- Certificates
CREATE POLICY "certificate_templates_select" ON public.certificate_templates FOR SELECT USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.certificate_rules cr WHERE cr.certificate_template_id = certificate_templates.id)
);

CREATE POLICY "certificate_templates_manage" ON public.certificate_templates FOR ALL USING (
    public.is_admin()
);

CREATE POLICY "certificate_rules_select" ON public.certificate_rules FOR SELECT USING (
    public.is_admin()
    OR (course_id IS NOT NULL AND public.can_access_course_content(course_id))
);

CREATE POLICY "certificate_rules_manage" ON public.certificate_rules FOR ALL USING (
    public.is_admin()
);

CREATE POLICY "earned_certificates_select" ON public.earned_certificates FOR SELECT USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR (course_id IS NOT NULL AND public.is_assigned_instructor(course_id))
);

CREATE POLICY "earned_certificates_manage" ON public.earned_certificates FOR ALL USING (
    public.is_admin()
);

-- Topic progress
CREATE POLICY "topic_progress_select" ON public.topic_progress FOR SELECT USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_assigned_instructor(course_id)
);

CREATE POLICY "topic_progress_manage" ON public.topic_progress FOR ALL USING (
    student_id = auth.uid() AND public.can_access_course_content(course_id)
);

-- Step progress
CREATE POLICY "step_progress_select" ON public.step_progress FOR SELECT USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_assigned_instructor(course_id)
);

CREATE POLICY "step_progress_manage" ON public.step_progress FOR ALL USING (
    student_id = auth.uid() AND public.can_access_course_content(course_id)
);

-- ------------------------------------------------------------------------------
-- 16. Deprecation comments (modules retained for Phase 1 UI)
-- ------------------------------------------------------------------------------
COMMENT ON TABLE public.modules IS
    'DEPRECATED: Phase 1 module container. LearnDash sections live in course_sections. Kept for backward compatibility.';

COMMENT ON TABLE public.course_sections IS
    'LearnDash section headings — organizational only, not lessons.';

COMMENT ON TABLE public.course_steps IS
    'Course builder tree. Placement for shared lessons, topics, and quizzes.';

COMMENT ON COLUMN public.lessons.course_id IS
    'DEPRECATED denormalized field for Phase 1 compat. Canonical placement: course_steps.';

COMMENT ON COLUMN public.lessons.module_id IS
    'DEPRECATED. Maps to course_steps.section_id via backfill.';

COMMENT ON COLUMN public.lessons.sort_order IS
    'DEPRECATED. Canonical order: course_steps.sort_order.';
