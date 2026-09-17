-- Explicit WITH CHECK on FOR ALL write policies (matches USING).
-- Postgres derives WITH CHECK from USING when omitted; spell it out for clarity/safety.

-- Initial schema policies
DROP POLICY IF EXISTS "course_instructors_manage_policy" ON public.course_instructors;
CREATE POLICY "course_instructors_manage_policy" ON public.course_instructors
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "modules_write_policy" ON public.modules;
CREATE POLICY "modules_write_policy" ON public.modules
FOR ALL
USING (public.is_admin() OR public.is_assigned_instructor(course_id))
WITH CHECK (public.is_admin() OR public.is_assigned_instructor(course_id));

DROP POLICY IF EXISTS "lessons_write_policy" ON public.lessons;
CREATE POLICY "lessons_write_policy" ON public.lessons
FOR ALL
USING (public.is_admin() OR public.is_assigned_instructor(course_id))
WITH CHECK (public.is_admin() OR public.is_assigned_instructor(course_id));

DROP POLICY IF EXISTS "enrollments_manage_policy" ON public.enrollments;
CREATE POLICY "enrollments_manage_policy" ON public.enrollments
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "progress_student_manage_policy" ON public.lesson_progress;
CREATE POLICY "progress_student_manage_policy" ON public.lesson_progress
FOR ALL
USING (student_id = auth.uid() AND public.can_access_course_content(course_id))
WITH CHECK (student_id = auth.uid() AND public.can_access_course_content(course_id));

DROP POLICY IF EXISTS "subscriptions_admin_manage_policy" ON public.subscriptions;
CREATE POLICY "subscriptions_admin_manage_policy" ON public.subscriptions
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Migration map
DROP POLICY IF EXISTS "wordpress_migration_map_admin_write" ON public.wordpress_migration_map;
CREATE POLICY "wordpress_migration_map_admin_write" ON public.wordpress_migration_map
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Phase 2 curriculum / groups / certificates / progress
DROP POLICY IF EXISTS "course_sections_write" ON public.course_sections;
CREATE POLICY "course_sections_write" ON public.course_sections
FOR ALL
USING (public.is_admin() OR public.is_assigned_instructor(course_id))
WITH CHECK (public.is_admin() OR public.is_assigned_instructor(course_id));

DROP POLICY IF EXISTS "course_steps_write" ON public.course_steps;
CREATE POLICY "course_steps_write" ON public.course_steps
FOR ALL
USING (public.is_admin() OR public.is_assigned_instructor(course_id))
WITH CHECK (public.is_admin() OR public.is_assigned_instructor(course_id));

DROP POLICY IF EXISTS "topics_write" ON public.topics;
CREATE POLICY "topics_write" ON public.topics
FOR ALL
USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.course_steps cs
        WHERE cs.topic_id = topics.id AND public.is_assigned_instructor(cs.course_id)
    )
)
WITH CHECK (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.course_steps cs
        WHERE cs.topic_id = topics.id AND public.is_assigned_instructor(cs.course_id)
    )
);

DROP POLICY IF EXISTS "quizzes_write" ON public.quizzes;
CREATE POLICY "quizzes_write" ON public.quizzes
FOR ALL
USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.course_steps cs
        WHERE cs.quiz_id = quizzes.id AND public.is_assigned_instructor(cs.course_id)
    )
)
WITH CHECK (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.course_steps cs
        WHERE cs.quiz_id = quizzes.id AND public.is_assigned_instructor(cs.course_id)
    )
);

DROP POLICY IF EXISTS "questions_write" ON public.questions;
CREATE POLICY "questions_write" ON public.questions
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "question_options_write" ON public.question_options;
CREATE POLICY "question_options_write" ON public.question_options
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "quiz_questions_write" ON public.quiz_questions;
CREATE POLICY "quiz_questions_write" ON public.quiz_questions
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "quiz_attempt_answers_manage" ON public.quiz_attempt_answers;
CREATE POLICY "quiz_attempt_answers_manage" ON public.quiz_attempt_answers
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.quiz_attempts qa
        WHERE qa.id = quiz_attempt_answers.attempt_id
          AND (qa.student_id = auth.uid() OR public.is_admin() OR public.is_assigned_instructor(qa.course_id))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.quiz_attempts qa
        WHERE qa.id = quiz_attempt_answers.attempt_id
          AND (qa.student_id = auth.uid() OR public.is_admin() OR public.is_assigned_instructor(qa.course_id))
    )
);

DROP POLICY IF EXISTS "groups_manage" ON public.groups;
CREATE POLICY "groups_manage" ON public.groups
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "group_users_manage" ON public.group_users;
CREATE POLICY "group_users_manage" ON public.group_users
FOR ALL
USING (public.is_admin() OR public.can_manage_group(group_id))
WITH CHECK (public.is_admin() OR public.can_manage_group(group_id));

DROP POLICY IF EXISTS "group_leaders_manage" ON public.group_leaders;
CREATE POLICY "group_leaders_manage" ON public.group_leaders
FOR ALL
USING (public.is_admin() OR public.can_manage_group(group_id))
WITH CHECK (public.is_admin() OR public.can_manage_group(group_id));

DROP POLICY IF EXISTS "group_courses_manage" ON public.group_courses;
CREATE POLICY "group_courses_manage" ON public.group_courses
FOR ALL
USING (public.is_admin() OR public.can_manage_group(group_id))
WITH CHECK (public.is_admin() OR public.can_manage_group(group_id));

DROP POLICY IF EXISTS "certificate_templates_manage" ON public.certificate_templates;
CREATE POLICY "certificate_templates_manage" ON public.certificate_templates
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "certificate_rules_manage" ON public.certificate_rules;
CREATE POLICY "certificate_rules_manage" ON public.certificate_rules
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "earned_certificates_manage" ON public.earned_certificates;
CREATE POLICY "earned_certificates_manage" ON public.earned_certificates
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "topic_progress_manage" ON public.topic_progress;
CREATE POLICY "topic_progress_manage" ON public.topic_progress
FOR ALL
USING (student_id = auth.uid() AND public.can_access_course_content(course_id))
WITH CHECK (student_id = auth.uid() AND public.can_access_course_content(course_id));

DROP POLICY IF EXISTS "step_progress_manage" ON public.step_progress;
CREATE POLICY "step_progress_manage" ON public.step_progress
FOR ALL
USING (student_id = auth.uid() AND public.can_access_course_content(course_id))
WITH CHECK (student_id = auth.uid() AND public.can_access_course_content(course_id));
