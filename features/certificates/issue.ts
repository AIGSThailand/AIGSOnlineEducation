import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { putCertificatePdfBuffer } from "@/lib/media/s3";
import { generateCertificatePdf } from "./pdf";
import { asTemplateData } from "./template-data";
import type { Json } from "@/types/database.types";

function verificationCode(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}

function displayName(
  first: string | null | undefined,
  last: string | null | undefined,
  email: string
) {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || email || "Student";
}

/** Rebuild PDF for one earned certificate and update pdf_url when S3 is configured. */
export async function regenerateCertificatePdf(
  earnedId: string
): Promise<{ ok: boolean; pdfUrl: string | null; error?: string }> {
  const admin = createAdminClient();

  const { data: earned, error } = await admin
    .from("earned_certificates")
    .select(
      `
      id,
      verification_code,
      earned_at,
      course_id,
      student_id,
      certificate_template_id,
      template:certificate_templates(title, template_data),
      course:courses(title),
      student:profiles!earned_certificates_student_id_fkey(email, first_name, last_name)
    `
    )
    .eq("id", earnedId)
    .maybeSingle<{
      id: string;
      verification_code: string;
      earned_at: string;
      course_id: string | null;
      student_id: string;
      certificate_template_id: string;
      template:
        | { title: string; template_data: Json }
        | { title: string; template_data: Json }[]
        | null;
      course: { title: string } | { title: string }[] | null;
      student:
        | { email: string; first_name: string | null; last_name: string | null }
        | { email: string; first_name: string | null; last_name: string | null }[]
        | null;
    }>();

  if (error || !earned) {
    return { ok: false, pdfUrl: null, error: error?.message || "Certificate not found." };
  }

  const template = Array.isArray(earned.template) ? earned.template[0] : earned.template;
  const course = Array.isArray(earned.course) ? earned.course[0] : earned.course;
  const student = Array.isArray(earned.student) ? earned.student[0] : earned.student;

  try {
    const pdf = await generateCertificatePdf({
      templateTitle: template?.title || "Certificate",
      templateData: asTemplateData(template?.template_data),
      studentName: displayName(student?.first_name, student?.last_name, student?.email || ""),
      courseTitle: course?.title || "Course",
      earnedAt: earned.earned_at,
      verificationCode: earned.verification_code,
    });

    const uploaded = await putCertificatePdfBuffer({ earnedId, body: pdf });
    if (!uploaded) {
      return {
        ok: true,
        pdfUrl: null,
        error: "PDF generated but S3 is not configured; pdf_url left unchanged.",
      };
    }

    await admin
      .from("earned_certificates")
      .update({ pdf_url: uploaded.publicUrl } as never)
      .eq("id", earnedId);

    return { ok: true, pdfUrl: uploaded.publicUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed.";
    console.error("[regenerateCertificatePdf]", message);
    return { ok: false, pdfUrl: null, error: message };
  }
}

export async function regenerateCertificatesForTemplate(
  templateId: string
): Promise<{ regenerated: number; failed: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("earned_certificates")
    .select("id")
    .eq("certificate_template_id", templateId)
    .returns<{ id: string }[]>();

  if (error || !data?.length) {
    if (error) console.error("[regenerateCertificatesForTemplate]", error.message);
    return { regenerated: 0, failed: 0 };
  }

  let regenerated = 0;
  let failed = 0;
  for (const row of data) {
    const result = await regenerateCertificatePdf(row.id);
    if (result.ok && result.pdfUrl) regenerated += 1;
    else if (!result.ok) failed += 1;
  }
  return { regenerated, failed };
}

export async function regenerateCertificatesForStudent(
  studentId: string
): Promise<{ regenerated: number; failed: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("earned_certificates")
    .select("id")
    .eq("student_id", studentId)
    .returns<{ id: string }[]>();

  if (error || !data?.length) {
    if (error) console.error("[regenerateCertificatesForStudent]", error.message);
    return { regenerated: 0, failed: 0 };
  }

  let regenerated = 0;
  let failed = 0;
  for (const row of data) {
    const result = await regenerateCertificatePdf(row.id);
    if (result.ok && result.pdfUrl) regenerated += 1;
    else if (!result.ok) failed += 1;
  }
  return { regenerated, failed };
}

/**
 * Issue missing course certificates for a student and generate PDFs when possible.
 * Idempotent via unique (student, template, course). Safe to call after every completion.
 */
export async function issueCourseCertificatesForStudent(
  studentId: string,
  courseId: string
): Promise<{ issuedIds: string[] }> {
  const admin = createAdminClient();

  const { data: rules, error: rulesError } = await admin
    .from("certificate_rules")
    .select("id, certificate_template_id")
    .eq("source_type", "course")
    .eq("course_id", courseId)
    .returns<{ id: string; certificate_template_id: string }[]>();

  if (rulesError) {
    console.error("[issueCourseCertificates] rules", rulesError.message);
    return { issuedIds: [] };
  }
  if (!rules?.length) return { issuedIds: [] };

  const issuedIds: string[] = [];

  for (const rule of rules) {
    const { data: existing } = await admin
      .from("earned_certificates")
      .select("id, pdf_url")
      .eq("student_id", studentId)
      .eq("certificate_template_id", rule.certificate_template_id)
      .eq("course_id", courseId)
      .maybeSingle<{ id: string; pdf_url: string | null }>();

    let earnedId = existing?.id ?? null;

    if (!earnedId) {
      const code = verificationCode();
      const { data: inserted, error: insertError } = await admin
        .from("earned_certificates")
        .insert({
          certificate_template_id: rule.certificate_template_id,
          student_id: studentId,
          course_id: courseId,
          verification_code: code,
          metadata: { source: "course_completion" },
        } as never)
        .select("id")
        .single<{ id: string }>();

      if (insertError) {
        if (insertError.code === "23505") {
          const { data: raced } = await admin
            .from("earned_certificates")
            .select("id, pdf_url")
            .eq("student_id", studentId)
            .eq("certificate_template_id", rule.certificate_template_id)
            .eq("course_id", courseId)
            .maybeSingle<{ id: string; pdf_url: string | null }>();
          if (!raced) continue;
          earnedId = raced.id;
          if (raced.pdf_url) continue;
        } else {
          console.error("[issueCourseCertificates] insert", insertError.message);
          continue;
        }
      } else {
        earnedId = inserted.id;
        issuedIds.push(inserted.id);
      }
    } else if (existing?.pdf_url) {
      continue;
    }

    if (!earnedId) continue;
    await regenerateCertificatePdf(earnedId);
  }

  return { issuedIds };
}
