"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import {
  canCreateCourse,
  canManageCourse,
  isAdmin,
  requireAdmin,
} from "@/features/courses/permissions";
import {
  createCourseSchema,
  stripeMappingSchema,
  updateCourseSchema,
  updateCourseStatusSchema,
} from "@/features/courses/schema";
import { slugExists } from "@/features/courses/queries";
import type { ActionResult, BuilderPortal } from "@/features/courses/types";
import type { Database } from "@/types/database.types";
import { slugifyTitle } from "@/features/courses/builder/ordering";

type CourseInsert = Database["public"]["Tables"]["courses"]["Insert"];

function revalidateCoursePaths(courseId: string, portal: BuilderPortal) {
  revalidatePath(`/${portal}/courses`);
  revalidatePath(`/${portal}/courses/${courseId}/edit`);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}/preview`);
}

export async function createCourseAction(
  portal: BuilderPortal,
  formData: FormData
): Promise<ActionResult<{ courseId: string }> | void> {
  const user = await getCurrentUser();
  if (!user || !(await canCreateCourse())) {
    return { success: false, error: "You are not authorized to create courses." };
  }

  const raw = {
    title: formData.get("title") as string,
    slug: (formData.get("slug") as string) || slugifyTitle(formData.get("title") as string),
    excerpt: (formData.get("excerpt") as string) || "",
    instructorId: (formData.get("instructorId") as string) || undefined,
  };

  const parsed = createCourseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid course data.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (await slugExists(parsed.data.slug)) {
    return { success: false, error: "This slug is already in use. Choose a different slug." };
  }

  const supabase = await createClient();
  const insertPayload: CourseInsert = {
    title: parsed.data.title,
    slug: parsed.data.slug,
    excerpt: parsed.data.excerpt || null,
    status: "draft",
  };

  const { data: course, error } = await supabase
    .from("courses")
    .insert([insertPayload] as never)
    .select("id")
    .single<{ id: string }>();

  if (error || !course) {
    return { success: false, error: error?.message || "Failed to create course." };
  }

  const instructorId =
    isAdmin(user) && parsed.data.instructorId
      ? parsed.data.instructorId
      : user.profile?.role === "instructor"
        ? user.id
        : parsed.data.instructorId;

  if (instructorId) {
    const { error: assignError } = await supabase.from("course_instructors").insert({
      course_id: course.id,
      instructor_id: instructorId,
    } as never);
    if (assignError) {
      return {
        success: false,
        error: `Course created but instructor assignment failed: ${assignError.message}`,
      };
    }
  }

  revalidateCoursePaths(course.id, portal);
  redirect(`/${portal}/courses/${course.id}/edit`);
}

export async function updateCourseAction(input: unknown): Promise<ActionResult> {
  const parsed = updateCourseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid data." };
  }

  const { courseId, instructorIds, ...fields } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "You are not authorized to edit this course." };
  }

  if (fields.slug && (await slugExists(fields.slug, courseId))) {
    return { success: false, error: "This slug is already in use." };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();

  const updatePayload: Record<string, unknown> = {};
  if (fields.title !== undefined) updatePayload.title = fields.title;
  if (fields.slug !== undefined) updatePayload.slug = fields.slug;
  if (fields.description !== undefined) updatePayload.description = fields.description;
  if (fields.excerpt !== undefined) updatePayload.excerpt = fields.excerpt || null;
  if (fields.thumbnailUrl !== undefined) updatePayload.thumbnail_url = fields.thumbnailUrl || null;
  if (fields.progressionType !== undefined) updatePayload.progression_type = fields.progressionType;

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from("courses").update(updatePayload as never).eq("id", courseId);
    if (error) return { success: false, error: error.message };
  }

  if (instructorIds && user && isAdmin(user)) {
    await supabase.from("course_instructors").delete().eq("course_id", courseId);
    if (instructorIds.length > 0) {
      const { error: assignError } = await supabase.from("course_instructors").insert(
        instructorIds.map((instructorId) => ({
          course_id: courseId,
          instructor_id: instructorId,
        })) as never
      );
      if (assignError) return { success: false, error: assignError.message };
    }
  }

  revalidatePath(`/admin/courses/${courseId}/edit`);
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  revalidatePath(`/courses/${courseId}`);
  return { success: true };
}

export async function updateCourseStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = updateCourseStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid status." };
  }

  const { courseId, status } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "You are not authorized to change this course status." };
  }

  if (status === "published") {
    const validation = await validateCourseForPublish(courseId);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(" ") };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("courses").update({ status } as never).eq("id", courseId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/admin/courses/${courseId}/edit`);
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/courses");
  return { success: true };
}

export async function updateStripeMappingAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();

  const parsed = stripeMappingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid Stripe data." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({
      stripe_product_id: parsed.data.stripeProductId || null,
      stripe_price_id: parsed.data.stripePriceId || null,
    } as never)
    .eq("id", parsed.data.courseId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/admin/courses/${parsed.data.courseId}/edit`);
  return { success: true };
}

export async function validateCourseForPublish(
  courseId: string
): Promise<{ valid: boolean; errors: string[] }> {
  const supabase = await createClient();
  const errors: string[] = [];

  const { data: course } = await supabase
    .from("courses")
    .select("title, slug")
    .eq("id", courseId)
    .maybeSingle<{ title: string; slug: string }>();

  if (!course?.title?.trim()) errors.push("Course title is required.");
  if (!course?.slug?.trim()) errors.push("Course slug is required.");

  const { count: moduleCount } = await supabase
    .from("modules")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  const { count: lessonCount } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  if ((moduleCount ?? 0) === 0) errors.push("Add at least one module.");
  if ((lessonCount ?? 0) === 0) errors.push("Add at least one lesson.");

  return { valid: errors.length === 0, errors };
}

export async function getPublishValidationAction(
  courseId: string
): Promise<ActionResult<{ errors: string[] }>> {
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }
  const result = await validateCourseForPublish(courseId);
  return { success: true, data: { errors: result.errors } };
}
