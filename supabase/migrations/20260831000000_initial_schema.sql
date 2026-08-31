-- ==============================================================================
-- AIGS Online Education Platform - Initial Migration
-- Compatible with LearnDash Migration & Stripe Subscriptions
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Enums and Custom Types
-- ------------------------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('admin', 'instructor', 'student');

-- ------------------------------------------------------------------------------
-- 2. Profiles Table (Linked to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    role public.user_role NOT NULL DEFAULT 'student'::public.user_role,
    wordpress_user_id BIGINT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 3. Courses Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    thumbnail_url TEXT,
    wordpress_course_id BIGINT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 4. Course Instructors Table (Many-to-Many)
-- ------------------------------------------------------------------------------
CREATE TABLE public.course_instructors (
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (course_id, instructor_id)
);

-- ------------------------------------------------------------------------------
-- 5. Modules Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 6. Lessons Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID REFERENCES public.modules(id) ON DELETE SET NULL,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT,
    video_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    wordpress_lesson_id BIGINT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_course_lesson_slug UNIQUE (course_id, slug)
);

-- ------------------------------------------------------------------------------
-- 7. Enrollments Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'expired')),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    stripe_subscription_id TEXT,
    wordpress_enrollment_id BIGINT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_student_course_enrollment UNIQUE (student_id, course_id)
);

-- ------------------------------------------------------------------------------
-- 8. Lesson Progress Table
-- ------------------------------------------------------------------------------
CREATE TABLE public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_student_lesson_progress UNIQUE (student_id, lesson_id)
);

-- ------------------------------------------------------------------------------
-- 9. Subscriptions Table (Stripe Integration)
-- ------------------------------------------------------------------------------
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    stripe_price_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 10. Indexes for High-Traffic Performance
-- ------------------------------------------------------------------------------
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_wp_id ON public.profiles(wordpress_user_id);
CREATE INDEX idx_courses_status ON public.courses(status);
CREATE INDEX idx_courses_slug ON public.courses(slug);
CREATE INDEX idx_courses_wp_id ON public.courses(wordpress_course_id);
CREATE INDEX idx_course_instructors_instructor ON public.course_instructors(instructor_id);
CREATE INDEX idx_modules_course ON public.modules(course_id, sort_order);
CREATE INDEX idx_lessons_course ON public.lessons(course_id, sort_order);
CREATE INDEX idx_lessons_module ON public.lessons(module_id, sort_order);
CREATE INDEX idx_lessons_wp_id ON public.lessons(wordpress_lesson_id);
CREATE INDEX idx_enrollments_student ON public.enrollments(student_id, status);
CREATE INDEX idx_enrollments_course ON public.enrollments(course_id, status);
CREATE INDEX idx_enrollments_wp_id ON public.enrollments(wordpress_enrollment_id);
CREATE INDEX idx_lesson_progress_student ON public.lesson_progress(student_id, course_id);
CREATE INDEX idx_lesson_progress_lesson ON public.lesson_progress(lesson_id);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

-- ------------------------------------------------------------------------------
-- 11. Automatic timestamp updater trigger
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER tr_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER tr_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER tr_lessons_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER tr_enrollments_updated_at BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER tr_lesson_progress_updated_at BEFORE UPDATE ON public.lesson_progress FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
CREATE TRIGGER tr_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ------------------------------------------------------------------------------
-- 12. Auto-create Profile Trigger upon Auth Sign Up
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role public.user_role;
BEGIN
    assigned_role := COALESCE(
        (NEW.raw_user_meta_data->>'role')::public.user_role,
        'student'::public.user_role
    );

    INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'avatar_url',
        assigned_role
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 13. Helper Security Functions (SECURITY DEFINER to prevent recursive RLS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT (public.current_user_role() = 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_instructor()
RETURNS BOOLEAN AS $$
    SELECT (public.current_user_role() = 'instructor');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_assigned_instructor(course_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.course_instructors
        WHERE course_instructors.course_id = $1
          AND course_instructors.instructor_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_enrolled_in_course(course_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE enrollments.course_id = $1
          AND enrollments.student_id = auth.uid()
          AND enrollments.status = 'active'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 14. Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------

-- Enable RLS on all public tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Profiles Policies
-- ------------------------------------------------------------------------------
-- SELECT: Users read own profile; Admins read all; Instructors read enrolled students
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING (
    id = auth.uid()
    OR public.is_admin()
    OR (
        public.is_instructor() AND EXISTS (
            SELECT 1 FROM public.enrollments e
            JOIN public.course_instructors ci ON ci.course_id = e.course_id
            WHERE e.student_id = profiles.id
              AND ci.instructor_id = auth.uid()
        )
    )
);

-- UPDATE: Users update own profile; Admins update any
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING (
    id = auth.uid() OR public.is_admin()
);

-- INSERT: Allowed via trigger (security definer) or Admin
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT WITH CHECK (
    id = auth.uid() OR public.is_admin()
);

-- DELETE: Admins only
CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE USING (
    public.is_admin()
);

-- ------------------------------------------------------------------------------
-- Courses Policies
-- ------------------------------------------------------------------------------
-- SELECT: Published courses are readable by everyone; Unpublished readable by assigned instructors and admins
CREATE POLICY "courses_select_policy" ON public.courses
FOR SELECT USING (
    status = 'published'
    OR public.is_admin()
    OR public.is_assigned_instructor(id)
);

-- INSERT: Admins and Instructors can create courses
CREATE POLICY "courses_insert_policy" ON public.courses
FOR INSERT WITH CHECK (
    public.is_admin() OR public.is_instructor()
);

-- UPDATE: Admins and assigned Instructors can update courses
CREATE POLICY "courses_update_policy" ON public.courses
FOR UPDATE USING (
    public.is_admin() OR public.is_assigned_instructor(id)
);

-- DELETE: Admins only
CREATE POLICY "courses_delete_policy" ON public.courses
FOR DELETE USING (
    public.is_admin()
);

-- ------------------------------------------------------------------------------
-- Course Instructors Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "course_instructors_select_policy" ON public.course_instructors
FOR SELECT USING (
    public.is_admin()
    OR instructor_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_instructors.course_id AND c.status = 'published'
    )
);

CREATE POLICY "course_instructors_manage_policy" ON public.course_instructors
FOR ALL USING (
    public.is_admin()
);

-- ------------------------------------------------------------------------------
-- Modules Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "modules_select_policy" ON public.modules
FOR SELECT USING (
    public.is_admin()
    OR public.is_assigned_instructor(course_id)
    OR (
        EXISTS (SELECT 1 FROM public.courses c WHERE c.id = modules.course_id AND c.status = 'published')
        AND (public.is_enrolled_in_course(course_id) OR auth.uid() IS NULL)
    )
);

CREATE POLICY "modules_write_policy" ON public.modules
FOR ALL USING (
    public.is_admin() OR public.is_assigned_instructor(course_id)
);

-- ------------------------------------------------------------------------------
-- Lessons Policies
-- ------------------------------------------------------------------------------
-- SELECT: Admins, assigned instructors, or actively enrolled students (or public preview if needed)
CREATE POLICY "lessons_select_policy" ON public.lessons
FOR SELECT USING (
    public.is_admin()
    OR public.is_assigned_instructor(course_id)
    OR public.is_enrolled_in_course(course_id)
);

CREATE POLICY "lessons_write_policy" ON public.lessons
FOR ALL USING (
    public.is_admin() OR public.is_assigned_instructor(course_id)
);

-- ------------------------------------------------------------------------------
-- Enrollments Policies
-- ------------------------------------------------------------------------------
-- SELECT: Students view own enrollments; Instructors view their courses; Admins view all
CREATE POLICY "enrollments_select_policy" ON public.enrollments
FOR SELECT USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_assigned_instructor(course_id)
);

-- INSERT/UPDATE/DELETE: Managed by server-side / webhook / admin
CREATE POLICY "enrollments_manage_policy" ON public.enrollments
FOR ALL USING (
    public.is_admin()
);

-- ------------------------------------------------------------------------------
-- Lesson Progress Policies
-- ------------------------------------------------------------------------------
-- SELECT: Students view own progress; Instructors view assigned courses; Admins view all
CREATE POLICY "progress_select_policy" ON public.lesson_progress
FOR SELECT USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR public.is_assigned_instructor(course_id)
);

-- INSERT/UPDATE: Students can update their own progress if enrolled
CREATE POLICY "progress_student_manage_policy" ON public.lesson_progress
FOR ALL USING (
    student_id = auth.uid() AND public.is_enrolled_in_course(course_id)
);

-- ------------------------------------------------------------------------------
-- Subscriptions Policies
-- ------------------------------------------------------------------------------
-- SELECT: Users view own subscription; Admins view all
CREATE POLICY "subscriptions_select_policy" ON public.subscriptions
FOR SELECT USING (
    user_id = auth.uid() OR public.is_admin()
);

-- INSERT/UPDATE/DELETE: Service Role only (Stripe Webhook) or Admin
CREATE POLICY "subscriptions_admin_manage_policy" ON public.subscriptions
FOR ALL USING (
    public.is_admin()
);
