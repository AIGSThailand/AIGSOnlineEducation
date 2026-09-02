-- Course Builder: allow instructors to self-assign as first instructor on a new course.
-- Required because courses_update_policy requires is_assigned_instructor(), but
-- course_instructors_manage_policy previously allowed admin-only inserts.

CREATE POLICY "course_instructors_instructor_self_assign"
ON public.course_instructors
FOR INSERT
WITH CHECK (
    public.is_admin()
    OR (
        public.is_instructor()
        AND instructor_id = auth.uid()
        AND NOT EXISTS (
            SELECT 1
            FROM public.course_instructors ci
            WHERE ci.course_id = course_instructors.course_id
        )
    )
);
