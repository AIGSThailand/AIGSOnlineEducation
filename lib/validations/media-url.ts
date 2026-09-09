import { z } from "zod";

/**
 * Accepts empty, absolute http(s) URLs, or private media proxy paths
 * (`/api/media/file?key=…`) stored after S3 upload in private mode.
 * Zod's `.url()` rejects relative paths, which broke thumbnail saves.
 */
export const mediaUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (!value) return true;
      if (value.startsWith("/api/media/file?")) return true;
      try {
        const u = new URL(value);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Enter a valid http(s) URL or upload media (private /api/media/file link)." }
  );

export const optionalMediaUrlSchema = mediaUrlSchema.optional().or(z.literal(""));
