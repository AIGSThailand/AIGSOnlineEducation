-- Preview settings belong to a course/lesson pair, including legacy placements.
CREATE TABLE public.course_lesson_previews (
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (course_id, lesson_id)
);
ALTER TABLE public.course_lesson_previews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_lesson_previews FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_lesson_previews TO authenticated;
CREATE POLICY preview_manage ON public.course_lesson_previews FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_assigned_instructor(course_id))
  WITH CHECK (
    (public.is_admin() OR public.is_assigned_instructor(course_id))
    AND (EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND l.course_id = course_lesson_previews.course_id)
      OR EXISTS (SELECT 1 FROM public.course_steps s WHERE s.course_id = course_lesson_previews.course_id
        AND s.lesson_id = course_lesson_previews.lesson_id AND s.step_type = 'lesson' AND s.parent_step_id IS NULL))
  );

CREATE FUNCTION public.public_preview_lesson_ids(p_course_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.lesson_id FROM public.course_lesson_previews p
  JOIN public.courses c ON c.id = p.course_id
  JOIN public.lessons l ON l.id = p.lesson_id
  WHERE p.course_id = p_course_id AND p.enabled
    AND c.status = 'published' AND c.access_type <> 'private' AND l.status = 'published'
    AND (EXISTS (SELECT 1 FROM public.course_steps s WHERE s.course_id = p.course_id
        AND s.lesson_id = p.lesson_id AND s.step_type = 'lesson' AND s.parent_step_id IS NULL)
      OR (l.course_id = p.course_id AND NOT EXISTS (
        SELECT 1 FROM public.course_sections sec WHERE sec.course_id = p.course_id)));
$$;

CREATE FUNCTION public.get_public_lesson_preview(p_course_id uuid, p_lesson_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', l.id, 'media_course_id', l.course_id, 'title', l.title, 'content', l.content,
    'video_url', l.video_url, 'video_captions_url', l.video_captions_url)
  FROM public.lessons l
  WHERE l.id = p_lesson_id
    AND l.id IN (SELECT public.public_preview_lesson_ids(p_course_id));
$$;

-- Settings reads and writes use caller RLS, never service-role access.
CREATE FUNCTION public.get_lesson_preview_setting(p_course_id uuid, p_lesson_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce((SELECT enabled FROM public.course_lesson_previews
    WHERE course_id = p_course_id AND lesson_id = p_lesson_id), false);
$$;
CREATE FUNCTION public.set_lesson_preview(p_course_id uuid, p_lesson_id uuid, p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT coalesce(public.is_admin() OR public.is_assigned_instructor(p_course_id), false) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.course_lesson_previews(course_id, lesson_id, enabled)
    VALUES (p_course_id, p_lesson_id, p_enabled)
    ON CONFLICT (course_id, lesson_id) DO UPDATE SET enabled = EXCLUDED.enabled;
END;
$$;

REVOKE ALL ON FUNCTION public.public_preview_lesson_ids(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_lesson_preview(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_lesson_preview_setting(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_lesson_preview(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_preview_lesson_ids(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_lesson_preview(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_lesson_preview_setting(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lesson_preview(uuid, uuid, boolean) TO authenticated;
