import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import type {
  CertificateRuleItem,
  CertificateTemplateDetail,
  CertificateTemplateListItem,
  EarnedCertificateListItem,
} from "./types";
import { asTemplateData } from "./template-data";
import { resolveCertificateCourseTitle } from "./format-course-title";

function displayName(first: string | null | undefined, last: string | null | undefined) {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || null;
}

type TemplateRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  template_data: Json;
  created_at: string;
  updated_at: string;
};

type RuleRow = {
  id: string;
  certificate_template_id: string;
  source_type: string;
  course_id: string | null;
  created_at: string;
  course: { id: string; title: string } | { id: string; title: string }[] | null;
};

type CourseTitleRow = {
  title: string;
  certificate_title?: string | null;
};

type EarnedRow = {
  id: string;
  certificate_template_id: string;
  student_id: string;
  course_id: string | null;
  earned_at: string;
  verification_code: string;
  pdf_url: string | null;
  metadata: Json;
  template:
    | { title: string; template_data?: Json }
    | { title: string; template_data?: Json }[]
    | null;
  course: CourseTitleRow | CourseTitleRow[] | null;
  student:
    | { email: string; first_name: string | null; last_name: string | null }
    | { email: string; first_name: string | null; last_name: string | null }[]
    | null;
};

function mapRule(row: RuleRow): CertificateRuleItem | null {
  if (row.source_type !== "course" || !row.course_id) return null;
  const course = Array.isArray(row.course) ? row.course[0] : row.course;
  return {
    id: row.id,
    certificateTemplateId: row.certificate_template_id,
    sourceType: "course",
    courseId: row.course_id,
    courseTitle: course?.title ?? null,
    createdAt: row.created_at,
  };
}

function mapEarned(row: EarnedRow): EarnedCertificateListItem {
  const template = Array.isArray(row.template) ? row.template[0] : row.template;
  const course = Array.isArray(row.course) ? row.course[0] : row.course;
  const student = Array.isArray(row.student) ? row.student[0] : row.student;
  return {
    id: row.id,
    certificateTemplateId: row.certificate_template_id,
    templateTitle: template?.title || "Certificate",
    templateData: asTemplateData(template?.template_data),
    studentId: row.student_id,
    studentName: displayName(student?.first_name, student?.last_name),
    studentEmail: student?.email ?? null,
    courseId: row.course_id,
    courseTitle: course ? resolveCertificateCourseTitle(course) : null,
    earnedAt: row.earned_at,
    verificationCode: row.verification_code,
    pdfUrl: row.pdf_url,
    metadata: row.metadata,
  };
}

export async function listCertificateTemplates(): Promise<CertificateTemplateListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificate_templates")
    .select("*, certificate_rules(id)")
    .order("created_at", { ascending: false })
    .returns<(TemplateRow & { certificate_rules: { id: string }[] | null })[]>();

  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    templateData: asTemplateData(row.template_data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ruleCount: row.certificate_rules?.length ?? 0,
  }));
}

export async function getCertificateTemplateById(
  id: string
): Promise<CertificateTemplateDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificate_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle<TemplateRow>();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: rules, error: rulesError } = await supabase
    .from("certificate_rules")
    .select(
      `
      id,
      certificate_template_id,
      source_type,
      course_id,
      created_at,
      course:courses(id, title)
    `
    )
    .eq("certificate_template_id", id)
    .eq("source_type", "course")
    .returns<RuleRow[]>();

  if (rulesError) throw new Error(rulesError.message);

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    description: data.description,
    templateData: asTemplateData(data.template_data),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    ruleCount: (rules || []).length,
    rules: (rules || []).map(mapRule).filter((r): r is CertificateRuleItem => !!r),
  };
}

export async function listEarnedCertificatesForAdmin(
  limit = 50
): Promise<EarnedCertificateListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("earned_certificates")
    .select(
      `
      *,
      template:certificate_templates(title, template_data),
      course:courses(title, certificate_title),
      student:profiles!earned_certificates_student_id_fkey(email, first_name, last_name)
    `
    )
    .order("earned_at", { ascending: false })
    .limit(limit)
    .returns<EarnedRow[]>();

  if (error) throw new Error(error.message);
  return (data || []).map(mapEarned);
}

export async function listMyEarnedCertificates(
  studentId: string
): Promise<EarnedCertificateListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("earned_certificates")
    .select(
      `
      *,
      template:certificate_templates(title, template_data),
      course:courses(title, certificate_title),
      student:profiles!earned_certificates_student_id_fkey(email, first_name, last_name)
    `
    )
    .eq("student_id", studentId)
    .order("earned_at", { ascending: false })
    .returns<EarnedRow[]>();

  if (error) throw new Error(error.message);
  return (data || []).map(mapEarned);
}

export async function countMyEarnedCertificates(studentId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("earned_certificates")
    .select("*", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (error) {
    console.error("[countMyEarnedCertificates]", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getEarnedCertificateById(
  id: string
): Promise<EarnedCertificateListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("earned_certificates")
    .select(
      `
      *,
      template:certificate_templates(title, template_data),
      course:courses(title, certificate_title),
      student:profiles!earned_certificates_student_id_fkey(email, first_name, last_name)
    `
    )
    .eq("id", id)
    .maybeSingle<EarnedRow>();

  if (error) throw new Error(error.message);
  return data ? mapEarned(data) : null;
}

/** Public verify — uses service role to avoid widening RLS. */
export async function getEarnedCertificateByVerificationCode(
  code: string
): Promise<EarnedCertificateListItem | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("earned_certificates")
    .select(
      `
      *,
      template:certificate_templates(title, template_data),
      course:courses(title, certificate_title),
      student:profiles!earned_certificates_student_id_fkey(email, first_name, last_name)
    `
    )
    .eq("verification_code", code.trim().toUpperCase())
    .maybeSingle<EarnedRow>();

  if (error) {
    console.error("[getEarnedCertificateByVerificationCode]", error.message);
    return null;
  }
  return data ? mapEarned(data) : null;
}

export async function listPublishedCoursesForSelect(): Promise<
  Array<{ id: string; title: string }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title")
    .order("title", { ascending: true })
    .returns<{ id: string; title: string }[]>();

  if (error) throw new Error(error.message);
  return data || [];
}
