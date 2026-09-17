-- ==============================================================================
-- Certificates issuance: idempotent course certificates
-- Migration: 20260911160000_certificates_issuance.sql
-- ==============================================================================

-- One earned certificate per student + template + course (course-source only).
CREATE UNIQUE INDEX IF NOT EXISTS uq_earned_certificates_student_template_course
  ON public.earned_certificates (student_id, certificate_template_id, course_id)
  WHERE course_id IS NOT NULL;
