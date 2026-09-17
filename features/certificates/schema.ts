import { z } from "zod";

export const certificateLayoutFontSchema = z.enum(["trirong", "helvetica"]);

const percentSchema = z.coerce.number().min(0).max(100);
const fontSizeSchema = z.coerce.number().min(8).max(120);

export const certificateLayoutFieldsSchema = z.object({
  backgroundImageUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal("")),
  nameFontSize: fontSizeSchema.optional(),
  nameYPercent: percentSchema.optional(),
  nameFont: certificateLayoutFontSchema.optional(),
  showCourseTitle: z.boolean().optional(),
  courseFontSize: fontSizeSchema.optional(),
  courseYPercent: percentSchema.optional(),
  courseFont: certificateLayoutFontSchema.optional(),
  dateFontSize: fontSizeSchema.optional(),
  dateYPercent: percentSchema.optional(),
  dateFont: certificateLayoutFontSchema.optional(),
  showVerification: z.boolean().optional(),
  verificationYPercent: percentSchema.optional(),
});

export const certificateBackgroundPresignSchema = z
  .object({
    templateId: z.string().uuid(),
    fileName: z.string().trim().min(1).max(200),
    contentType: z.string().trim().min(3).max(120),
    fileSize: z.number().int().positive(),
  })
  .superRefine((data, ctx) => {
    const accept = ["image/jpeg", "image/png", "image/webp"];
    if (!accept.includes(data.contentType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsupported file type: ${data.contentType}. Use JPG, PNG, or WebP.`,
        path: ["contentType"],
      });
    }
    const maxBytes = 8 * 1024 * 1024;
    if (data.fileSize > maxBytes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Background image too large (max 8MB).",
        path: ["fileSize"],
      });
    }
  });

export const createCertificateTemplateSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    slug: z.string().trim().max(200).optional().or(z.literal("")),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    headline: z.string().trim().max(200).optional().or(z.literal("")),
    footer: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .merge(certificateLayoutFieldsSchema);

export const updateCertificateTemplateSchema = createCertificateTemplateSchema.extend({
  templateId: z.string().uuid(),
});

export const templateIdSchema = z.object({
  templateId: z.string().uuid(),
});

export const earnedIdSchema = z.object({
  earnedId: z.string().uuid(),
});

export const attachCourseRuleSchema = z.object({
  templateId: z.string().uuid(),
  courseId: z.string().uuid(),
});

export const ruleIdSchema = z.object({
  ruleId: z.string().uuid(),
});
