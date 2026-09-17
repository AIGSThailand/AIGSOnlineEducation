-- Run with psql -v ON_ERROR_STOP=1 against an isolated local migrated database.
BEGIN;
CREATE TEMP TABLE preview_fixture (course_id uuid, second_course_id uuid, lesson_id uuid, paid_id uuid);
INSERT INTO preview_fixture VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
GRANT SELECT ON preview_fixture TO anon, authenticated;
INSERT INTO public.courses(id, title, slug, status, access_type)
SELECT course_id, 'Preview test', course_id::text, 'published', 'paid'::public.course_access_type FROM preview_fixture
UNION ALL SELECT second_course_id, 'Second test', second_course_id::text, 'published', 'paid'::public.course_access_type FROM preview_fixture;
INSERT INTO public.lessons(id, course_id, title, slug, status, content)
SELECT lesson_id, course_id, 'Preview lesson', 'preview', 'published'::public.content_status, 'Public sample' FROM preview_fixture
UNION ALL SELECT paid_id, course_id, 'Paid lesson', 'paid', 'published'::public.content_status, 'Protected sample' FROM preview_fixture;
INSERT INTO public.course_steps(course_id, lesson_id, step_type)
SELECT second_course_id, lesson_id, 'lesson' FROM preview_fixture;
INSERT INTO public.course_lesson_previews(course_id, lesson_id, enabled)
SELECT course_id, lesson_id, true FROM preview_fixture;

SET LOCAL ROLE anon;
DO $$
DECLARE f record; result jsonb;
BEGIN
  SELECT * INTO f FROM preview_fixture;
  result := public.get_public_lesson_preview(f.course_id, f.lesson_id);
  ASSERT result->>'content' = 'Public sample', 'Enabled preview is readable';
  ASSERT NOT (result ? 'source_content_html'), 'Internal fields are excluded';
  ASSERT public.get_public_lesson_preview(f.course_id, f.paid_id) IS NULL, 'Paid lesson is locked';
  ASSERT public.get_public_lesson_preview(f.second_course_id, f.lesson_id) IS NULL, 'Reuse does not inherit preview';
  ASSERT NOT EXISTS (SELECT 1 FROM public.lessons WHERE id IN (f.lesson_id, f.paid_id)), 'Raw lesson RLS is unchanged';
  ASSERT public.can_access_course_content(f.course_id) IS NOT TRUE, 'Preview does not grant entitlement';
  BEGIN
    PERFORM public.set_lesson_preview(f.course_id, f.paid_id, true);
    RAISE EXCEPTION 'Anonymous configuration write unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM preview_fixture;
  BEGIN
    PERFORM public.set_lesson_preview(f.course_id, f.paid_id, true);
    RAISE EXCEPTION 'Unassigned configuration write unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

UPDATE public.courses SET access_type = 'private' WHERE id = (SELECT course_id FROM preview_fixture);
SET LOCAL ROLE anon;
DO $$ BEGIN
  ASSERT (SELECT public.get_public_lesson_preview(course_id, lesson_id) IS NULL FROM preview_fixture), 'Private course excluded';
END $$;
RESET ROLE;
UPDATE public.courses SET access_type = 'paid', status = 'draft' WHERE id = (SELECT course_id FROM preview_fixture);
SET LOCAL ROLE anon;
DO $$ BEGIN
  ASSERT (SELECT public.get_public_lesson_preview(course_id, lesson_id) IS NULL FROM preview_fixture), 'Draft course excluded';
END $$;
RESET ROLE;
UPDATE public.courses SET status = 'published' WHERE id = (SELECT course_id FROM preview_fixture);
UPDATE public.lessons SET status = 'draft' WHERE id = (SELECT lesson_id FROM preview_fixture);
SET LOCAL ROLE anon;
DO $$ BEGIN
  ASSERT (SELECT public.get_public_lesson_preview(course_id, lesson_id) IS NULL FROM preview_fixture), 'Draft lesson excluded';
END $$;
RESET ROLE;
UPDATE public.lessons SET status = 'published' WHERE id = (SELECT lesson_id FROM preview_fixture);
UPDATE public.course_lesson_previews SET enabled = false WHERE course_id = (SELECT course_id FROM preview_fixture);
SET LOCAL ROLE anon;
DO $$ BEGIN
  ASSERT (SELECT public.get_public_lesson_preview(course_id, lesson_id) IS NULL FROM preview_fixture), 'Disabled preview excluded';
END $$;
RESET ROLE;

-- Explicitly enable the reused placement, then remove it: stale settings cannot expose it.
INSERT INTO public.course_lesson_previews(course_id, lesson_id, enabled)
SELECT second_course_id, lesson_id, true FROM preview_fixture;
SET LOCAL ROLE anon;
DO $$ BEGIN
  ASSERT (SELECT public.get_public_lesson_preview(second_course_id, lesson_id) IS NOT NULL FROM preview_fixture), 'Reused placement can be explicitly enabled';
END $$;
RESET ROLE;
DELETE FROM public.course_steps WHERE course_id = (SELECT second_course_id FROM preview_fixture);
SET LOCAL ROLE anon;
DO $$ BEGIN
  ASSERT (SELECT public.get_public_lesson_preview(second_course_id, lesson_id) IS NULL FROM preview_fixture), 'Removed placement excluded';
END $$;
RESET ROLE;
ROLLBACK;
