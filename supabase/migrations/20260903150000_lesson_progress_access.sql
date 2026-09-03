-- Allow progress writes for anyone who can access the course (group members,
-- staff preview), not only enrollments.

DROP POLICY IF EXISTS "progress_student_manage_policy" ON public.lesson_progress;

CREATE POLICY "progress_student_manage_policy" ON public.lesson_progress
FOR ALL USING (
    student_id = auth.uid() AND public.can_access_course_content(course_id)
);
