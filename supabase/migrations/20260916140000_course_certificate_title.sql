-- Optional display title for certificate overlays (falls back to courses.title when null).

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS certificate_title TEXT;

COMMENT ON COLUMN public.courses.certificate_title IS
  'Optional title shown on certificates; when null, courses.title is used.';
