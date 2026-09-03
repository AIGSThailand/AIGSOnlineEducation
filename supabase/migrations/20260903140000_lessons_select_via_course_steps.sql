-- Allow lesson SELECT when the lesson is placed in a course via course_steps
-- (reusable lessons may have a different primary lessons.course_id).

DROP POLICY IF EXISTS "lessons_select_policy" ON public.lessons;

CREATE POLICY "lessons_select_policy" ON public.lessons
FOR SELECT USING (
    public.is_admin()
    OR public.is_assigned_instructor(course_id)
    OR public.is_enrolled_in_course(course_id)
    OR EXISTS (
        SELECT 1
        FROM public.course_steps cs
        WHERE cs.lesson_id = lessons.id
          AND (
              public.is_assigned_instructor(cs.course_id)
              OR public.can_access_course_content(cs.course_id)
          )
    )
);
