export type MediaAssetKind =
  | "thumbnail"
  | "lesson-image"
  | "promo"
  | "attachment"
  | "lesson-video"
  | "caption";

export const MEDIA_KIND_LIMITS: Record<
  MediaAssetKind,
  { maxBytes: number; accept: string[]; label: string }
> = {
  thumbnail: {
    maxBytes: 5 * 1024 * 1024,
    accept: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    label: "Thumbnail image",
  },
  "lesson-image": {
    maxBytes: 8 * 1024 * 1024,
    accept: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    label: "Lesson image",
  },
  promo: {
    maxBytes: 5 * 1024 * 1024,
    accept: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    label: "Promotional image",
  },
  attachment: {
    maxBytes: 25 * 1024 * 1024,
    accept: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/zip",
    ],
    label: "Attachment",
  },
  "lesson-video": {
    maxBytes: 500 * 1024 * 1024,
    accept: ["video/mp4", "video/webm", "video/quicktime"],
    label: "Lesson video",
  },
  caption: {
    maxBytes: 2 * 1024 * 1024,
    accept: ["text/vtt", "text/plain", "application/octet-stream"],
    label: "Caption file",
  },
};

export type PresignUploadRequest = {
  courseId?: string;
  groupId?: string;
  kind: MediaAssetKind;
  fileName: string;
  contentType: string;
  fileSize: number;
};

export type PresignUploadResponse = {
  uploadUrl: string;
  /** Stable URL for DB / HTML — CDN when public, `/api/media/file?key=` when private. */
  publicUrl: string;
  key: string;
  access: "public" | "private";
  headers: Record<string, string>;
  expiresIn: number;
};
