import { z } from "zod";
import { MEDIA_KIND_LIMITS, type MediaAssetKind } from "./types";

export const mediaAssetKindSchema = z.enum([
  "thumbnail",
  "lesson-image",
  "promo",
  "attachment",
]);

export const presignUploadSchema = z
  .object({
    courseId: z.string().uuid(),
    kind: mediaAssetKindSchema,
    fileName: z.string().trim().min(1).max(200),
    contentType: z.string().trim().min(3).max(120),
    fileSize: z.number().int().positive(),
  })
  .superRefine((data, ctx) => {
    const limits = MEDIA_KIND_LIMITS[data.kind as MediaAssetKind];
    if (!limits.accept.includes(data.contentType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsupported file type for ${limits.label}: ${data.contentType}`,
        path: ["contentType"],
      });
    }
    if (data.fileSize > limits.maxBytes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `File too large for ${limits.label} (max ${Math.round(limits.maxBytes / (1024 * 1024))}MB).`,
        path: ["fileSize"],
      });
    }
  });
