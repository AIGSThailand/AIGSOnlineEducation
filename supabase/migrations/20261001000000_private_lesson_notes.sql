CREATE TABLE public.lesson_notes (
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, course_id, lesson_id)
);
ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_notes TO authenticated;
-- No instructor/admin read policy: notes are private to their author.
CREATE POLICY notes_owner ON public.lesson_notes FOR ALL TO authenticated
  USING (student_id = (SELECT auth.uid()))
  WITH CHECK (student_id = (SELECT auth.uid()));
