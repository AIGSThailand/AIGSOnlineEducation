-- Phase 1: LearnDash-style course access expiration + Extend Access support
-- - Course defaults: access_expiration_enabled + access_period_days
-- - Per-enrollment expires_at
-- - is_enrolled_in_course treats past expires_at as no access

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS access_expiration_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_period_days INTEGER
    CHECK (access_period_days IS NULL OR access_period_days > 0);

COMMENT ON COLUMN public.courses.access_expiration_enabled IS
  'When true, new enrollments get expires_at = enrolled_at + access_period_days (LearnDash Access Period).';
COMMENT ON COLUMN public.courses.access_period_days IS
  'Default access length in days when access_expiration_enabled is true.';

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.enrollments.expires_at IS
  'When access ends. NULL = no expiration. Past expires_at denies content access.';

CREATE INDEX IF NOT EXISTS idx_enrollments_expires_at
  ON public.enrollments (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_course_status_expires
  ON public.enrollments (course_id, status, expires_at);

-- Active enrollment requires status=active and not past expires_at
CREATE OR REPLACE FUNCTION public.is_enrolled_in_course(course_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE enrollments.course_id = $1
          AND enrollments.student_id = auth.uid()
          AND enrollments.status = 'active'
          AND (
            enrollments.expires_at IS NULL
            OR enrollments.expires_at > timezone('utc'::text, now())
          )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Mark overdue active enrollments as expired (callable from cron / admin ops)
CREATE OR REPLACE FUNCTION public.expire_overdue_enrollments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.enrollments
  SET
    status = 'expired',
    updated_at = timezone('utc'::text, now())
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at <= timezone('utc'::text, now());

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_overdue_enrollments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_overdue_enrollments() TO service_role;
