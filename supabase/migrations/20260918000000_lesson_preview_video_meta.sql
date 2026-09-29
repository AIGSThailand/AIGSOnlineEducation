-- Extend public lesson preview payload for Phase 1 video workspace
-- (poster + plain transcript). Captions/video already returned.

CREATE OR REPLACE FUNCTION public.get_public_lesson_preview(p_course_id uuid, p_lesson_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', l.id,
    'media_course_id', l.course_id,
    'title', l.title,
    'content', l.content,
    'video_url', l.video_url,
    'video_captions_url', l.video_captions_url,
    'video_thumbnail_url', l.video_thumbnail_url,
    'video_transcript', l.video_transcript
  )
  FROM public.lessons l
  WHERE l.id = p_lesson_id
    AND l.id IN (SELECT public.public_preview_lesson_ids(p_course_id));
$$;
