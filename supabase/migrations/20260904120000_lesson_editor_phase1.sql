-- Phase 1 Lesson Editor: structured TipTap fields, media, learning settings, resources.
-- Keep lessons.content as the editable/rendered HTML (equivalent to content_html).
-- source_content_html is immutable migration/audit data after first import.

-- ------------------------------------------------------------------------------
-- 1. Lesson content + media + learning columns
-- ------------------------------------------------------------------------------
ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS content_json JSONB,
    ADD COLUMN IF NOT EXISTS source_content_html TEXT,
    ADD COLUMN IF NOT EXISTS featured_image_url TEXT,
    ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER
        CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes >= 0),
    ADD COLUMN IF NOT EXISTS video_provider TEXT
        CHECK (
            video_provider IS NULL
            OR video_provider IN (
                'youtube',
                'vimeo',
                'bunny',
                'cloudflare',
                'self_hosted',
                'external'
            )
        ),
    ADD COLUMN IF NOT EXISTS video_id TEXT,
    ADD COLUMN IF NOT EXISTS video_duration_seconds INTEGER
        CHECK (video_duration_seconds IS NULL OR video_duration_seconds > 0),
    ADD COLUMN IF NOT EXISTS video_thumbnail_url TEXT,
    ADD COLUMN IF NOT EXISTS video_transcript TEXT,
    ADD COLUMN IF NOT EXISTS video_captions_url TEXT,
    ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS completion_type TEXT NOT NULL DEFAULT 'manual'
        CHECK (
            completion_type IN (
                'manual',
                'content_view',
                'video_watch',
                'quiz_pass',
                'assignment_submit',
                'automatic'
            )
        ),
    ADD COLUMN IF NOT EXISTS completion_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS drip_type TEXT NOT NULL DEFAULT 'immediate'
        CHECK (
            drip_type IN (
                'immediate',
                'days_after_enrollment',
                'fixed_date',
                'prerequisite'
            )
        ),
    ADD COLUMN IF NOT EXISTS drip_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lessons.content IS
    'Current editable/rendered lesson HTML (content_html). Student views sanitize at render time.';
COMMENT ON COLUMN public.lessons.content_json IS
    'TipTap JSON document for structured editing. Optional until first visual save.';
COMMENT ON COLUMN public.lessons.source_content_html IS
    'Immutable original imported LearnDash/WordPress HTML. Never overwrite after initial set.';

-- Backfill immutable source from existing migrated content (once).
UPDATE public.lessons
SET source_content_html = content
WHERE source_content_html IS NULL
  AND content IS NOT NULL
  AND content <> ''
  AND (
      wordpress_lesson_id IS NOT NULL
      OR EXISTS (
          SELECT 1
          FROM public.wordpress_migration_map m
          WHERE m.target_id = lessons.id
            AND m.source_type IN ('sfwd-lessons', 'sfwd-topic')
      )
  );

-- Infer a basic video provider from existing video_url when missing.
UPDATE public.lessons
SET video_provider = CASE
    WHEN video_url ILIKE '%youtube.com%' OR video_url ILIKE '%youtu.be%' THEN 'youtube'
    WHEN video_url ILIKE '%vimeo.com%' THEN 'vimeo'
    WHEN video_url IS NOT NULL AND video_url <> '' THEN 'external'
    ELSE NULL
END
WHERE video_provider IS NULL
  AND video_url IS NOT NULL
  AND video_url <> '';

-- ------------------------------------------------------------------------------
-- 2. Lesson resources
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL DEFAULT 'other'
        CHECK (
            resource_type IN (
                'pdf',
                'image',
                'document',
                'spreadsheet',
                'link',
                'download',
                'other'
            )
        ),
    title TEXT NOT NULL,
    url TEXT,
    storage_path TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    is_downloadable BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lesson_resources_lesson
    ON public.lesson_resources(lesson_id, position);

DROP TRIGGER IF EXISTS tr_lesson_resources_updated_at ON public.lesson_resources;
CREATE TRIGGER tr_lesson_resources_updated_at
    BEFORE UPDATE ON public.lesson_resources
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_resources_select_policy" ON public.lesson_resources;
CREATE POLICY "lesson_resources_select_policy" ON public.lesson_resources
FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM public.lessons l
        WHERE l.id = lesson_resources.lesson_id
          AND (
              public.is_admin()
              OR public.is_assigned_instructor(l.course_id)
              OR public.is_enrolled_in_course(l.course_id)
              OR EXISTS (
                  SELECT 1
                  FROM public.course_steps cs
                  WHERE cs.lesson_id = l.id
                    AND (
                        public.is_assigned_instructor(cs.course_id)
                        OR public.is_enrolled_in_course(cs.course_id)
                    )
              )
          )
    )
);

DROP POLICY IF EXISTS "lesson_resources_write_policy" ON public.lesson_resources;
CREATE POLICY "lesson_resources_write_policy" ON public.lesson_resources
FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.lessons l
        WHERE l.id = lesson_resources.lesson_id
          AND (public.is_admin() OR public.is_assigned_instructor(l.course_id))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.lessons l
        WHERE l.id = lesson_resources.lesson_id
          AND (public.is_admin() OR public.is_assigned_instructor(l.course_id))
    )
);
