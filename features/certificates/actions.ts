"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/courses/permissions";
import type { ActionResult } from "@/features/courses/types";
import {
  attachCourseRuleSchema,
  createCertificateTemplateSchema,
  earnedIdSchema,
  ruleIdSchema,
  templateIdSchema,
  updateCertificateTemplateSchema,
} from "./schema";
import { parseTemplateDataJson } from "./template-data";
import {
  regenerateCertificatePdf,
  regenerateCertificatesForTemplate,
} from "./issue";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function layoutFromParsed(data: {
  headline?: string;
  footer?: string;
  backgroundImageUrl?: string;
  nameFontSize?: number;
  nameYPercent?: number;
  nameFont?: "trirong" | "helvetica";
  showCourseTitle?: boolean;
  courseFontSize?: number;
  courseYPercent?: number;
  courseFont?: "trirong" | "helvetica";
  dateFontSize?: number;
  dateYPercent?: number;
  dateFont?: "trirong" | "helvetica";
  showVerification?: boolean;
  verificationYPercent?: number;
}) {
  return parseTemplateDataJson({
    headline: data.headline,
    footer: data.footer,
    backgroundImageUrl: data.backgroundImageUrl?.trim() || undefined,
    nameFontSize: data.nameFontSize,
    nameYPercent: data.nameYPercent,
    nameFont: data.nameFont,
    showCourseTitle: data.showCourseTitle,
    courseFontSize: data.courseFontSize,
    courseYPercent: data.courseYPercent,
    courseFont: data.courseFont,
    dateFontSize: data.dateFontSize,
    dateYPercent: data.dateYPercent,
    dateFont: data.dateFont,
    showVerification: data.showVerification,
    verificationYPercent: data.verificationYPercent,
  });
}

function revalidateCertificates(templateId?: string, earnedId?: string) {
  revalidatePath("/admin/certificates");
  revalidatePath("/student/certificates");
  revalidatePath("/student/dashboard");
  if (templateId) revalidatePath(`/admin/certificates/${templateId}`);
  if (earnedId) revalidatePath(`/student/certificates/${earnedId}`);
}

export async function createCertificateTemplateAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = createCertificateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid template." };
  }

  const slug = parsed.data.slug?.trim() || slugify(parsed.data.title);
  if (!slug) return { success: false, error: "Slug is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificate_templates")
    .insert({
      title: parsed.data.title,
      slug,
      description: parsed.data.description || null,
      template_data: layoutFromParsed(parsed.data),
    } as never)
    .select("id")
    .single<{ id: string }>();

  if (error) return { success: false, error: error.message };

  revalidateCertificates(data.id);
  return { success: true, data: { id: data.id } };
}

export async function updateCertificateTemplateAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateCertificateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid update." };
  }

  const slug = parsed.data.slug?.trim() || slugify(parsed.data.title);
  const supabase = await createClient();
  const { error } = await supabase
    .from("certificate_templates")
    .update({
      title: parsed.data.title,
      slug,
      description: parsed.data.description || null,
      template_data: layoutFromParsed(parsed.data),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", parsed.data.templateId);

  if (error) return { success: false, error: error.message };

  revalidateCertificates(parsed.data.templateId);
  return { success: true };
}

export async function deleteCertificateTemplateAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = templateIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid template." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("certificate_templates")
    .delete()
    .eq("id", parsed.data.templateId);

  if (error) return { success: false, error: error.message };

  revalidateCertificates();
  return { success: true };
}

export async function attachCourseRuleAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = attachCourseRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid rule." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("certificate_rules").insert({
    certificate_template_id: parsed.data.templateId,
    source_type: "course",
    course_id: parsed.data.courseId,
    quiz_id: null,
    group_id: null,
  } as never);

  if (error) return { success: false, error: error.message };

  revalidateCertificates(parsed.data.templateId);
  return { success: true };
}

export async function detachCertificateRuleAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = ruleIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid rule." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("certificate_rules")
    .delete()
    .eq("id", parsed.data.ruleId);

  if (error) return { success: false, error: error.message };

  revalidateCertificates();
  return { success: true };
}

export async function regenerateEarnedCertificateAction(
  input: unknown
): Promise<ActionResult<{ pdfUrl: string | null }>> {
  await requireAdmin();
  const parsed = earnedIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid certificate." };

  const result = await regenerateCertificatePdf(parsed.data.earnedId);
  if (!result.ok) {
    return { success: false, error: result.error || "Failed to regenerate PDF." };
  }

  revalidateCertificates(undefined, parsed.data.earnedId);
  return { success: true, data: { pdfUrl: result.pdfUrl } };
}

export async function regenerateTemplateCertificatesAction(
  input: unknown
): Promise<ActionResult<{ regenerated: number; failed: number }>> {
  await requireAdmin();
  const parsed = templateIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid template." };

  const result = await regenerateCertificatesForTemplate(parsed.data.templateId);
  revalidateCertificates(parsed.data.templateId);
  return { success: true, data: result };
}
