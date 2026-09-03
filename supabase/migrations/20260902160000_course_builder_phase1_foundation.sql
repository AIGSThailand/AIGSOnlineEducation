-- Phase 1 Course Builder foundation: migration audit map (LearnDash compatibility).
-- course_steps already implements the ordered curriculum layer (spec "course_items").

CREATE TYPE public.wordpress_migration_source_type AS ENUM (
    'sfwd-courses',
    'sfwd-lessons',
    'sfwd-topic',
    'sfwd-quiz',
    'sfwd-question',
    'sfwd-certificates',
    'groups',
    'user'
);

CREATE TYPE public.wordpress_migration_target_type AS ENUM (
    'course',
    'section',
    'lesson',
    'topic',
    'quiz',
    'question',
    'certificate',
    'group',
    'profile'
);

CREATE TABLE IF NOT EXISTS public.wordpress_migration_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type public.wordpress_migration_source_type NOT NULL,
    wordpress_id BIGINT NOT NULL,
    target_type public.wordpress_migration_target_type NOT NULL,
    target_id UUID NOT NULL,
    source_url TEXT,
    migration_batch_id TEXT,
    source_data JSONB,
    migrated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_wordpress_migration_map_source UNIQUE (source_type, wordpress_id)
);

CREATE INDEX idx_wordpress_migration_map_target
    ON public.wordpress_migration_map (target_type, target_id);

CREATE INDEX idx_wordpress_migration_map_batch
    ON public.wordpress_migration_map (migration_batch_id)
    WHERE migration_batch_id IS NOT NULL;

ALTER TABLE public.wordpress_migration_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wordpress_migration_map_admin_select"
    ON public.wordpress_migration_map FOR SELECT
    USING (public.is_admin());

CREATE POLICY "wordpress_migration_map_admin_write"
    ON public.wordpress_migration_map FOR ALL
    USING (public.is_admin());

COMMENT ON TABLE public.wordpress_migration_map IS
    'Audit trail linking LearnDash/WordPress source IDs to Supabase targets. Admin-only.';

COMMENT ON TABLE public.course_steps IS
    'Ordered curriculum layer (equivalent to course_items in builder spec). References lessons, topics, quizzes.';
