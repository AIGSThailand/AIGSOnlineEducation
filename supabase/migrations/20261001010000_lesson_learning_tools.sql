CREATE TABLE public.lesson_bookmarks (
 student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
 lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (student_id, course_id, lesson_id)
);
ALTER TABLE public.lesson_bookmarks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_bookmarks FROM anon;
GRANT SELECT, INSERT, DELETE ON public.lesson_bookmarks TO authenticated;
CREATE POLICY bookmarks_owner ON public.lesson_bookmarks FOR ALL TO authenticated
 USING (student_id = (SELECT auth.uid())) WITH CHECK (student_id = (SELECT auth.uid()));

CREATE TABLE public.lesson_questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
 lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lesson_questions_thread ON public.lesson_questions(course_id, lesson_id, student_id, created_at);
ALTER TABLE public.lesson_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_questions FROM anon;
GRANT SELECT, INSERT ON public.lesson_questions TO authenticated;
CREATE POLICY questions_read ON public.lesson_questions FOR SELECT TO authenticated
 USING (student_id = (SELECT auth.uid()) OR public.is_admin() OR public.is_assigned_instructor(course_id));
CREATE POLICY questions_write ON public.lesson_questions FOR INSERT TO authenticated
 WITH CHECK (author_id = (SELECT auth.uid()) AND
   (student_id = (SELECT auth.uid()) OR public.is_admin() OR public.is_assigned_instructor(course_id))
   AND public.can_access_course_content(course_id)
   AND (EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND l.course_id = lesson_questions.course_id)
     OR EXISTS (SELECT 1 FROM public.course_steps s WHERE s.lesson_id = lesson_questions.lesson_id AND s.course_id = lesson_questions.course_id)));
