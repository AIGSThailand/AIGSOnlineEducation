-- Public catalog projection only: never expose lesson content or video URLs.
CREATE OR REPLACE FUNCTION public.get_public_course_lessons(p_course_id uuid)
RETURNS TABLE (id uuid, module_id uuid, title text, slug text, sort_order integer, status public.content_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT l.id, l.module_id, l.title, l.slug, l.sort_order, l.status
  FROM public.lessons l
  WHERE l.status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = p_course_id AND c.status = 'published'
    )
    AND (l.course_id = p_course_id OR EXISTS (
      SELECT 1 FROM public.course_steps s
      WHERE s.course_id = p_course_id AND s.lesson_id = l.id
        AND s.step_type = 'lesson' AND s.parent_step_id IS NULL
    ));
$$;

REVOKE ALL ON FUNCTION public.get_public_course_lessons(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_course_lessons(uuid) TO anon, authenticated;
