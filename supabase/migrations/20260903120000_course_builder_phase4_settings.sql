-- =============================================================================
-- Course Builder Phase 4 — Course settings fields
-- Migration: 20260903120000_course_builder_phase4_settings.sql
--
-- Additive only:
-- - course_access_type enum + courses.access_type
-- - courses.promotional_video_url
-- =============================================================================

CREATE TYPE public.course_access_type AS ENUM (
    'open',
    'enrollment_required',
    'paid',
    'private'
);

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS access_type public.course_access_type
        NOT NULL DEFAULT 'enrollment_required',
    ADD COLUMN IF NOT EXISTS promotional_video_url TEXT;

COMMENT ON COLUMN public.courses.access_type IS
    'Course access policy for catalog/player. Enforced in application + future RLS refinements.';

COMMENT ON COLUMN public.courses.promotional_video_url IS
    'Optional trailer / promo video URL shown on course detail pages.';

CREATE INDEX IF NOT EXISTS idx_courses_access_type ON public.courses(access_type);
