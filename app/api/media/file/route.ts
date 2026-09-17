import { NextRequest, NextResponse } from "next/server";
import { authorizeGroupMediaRead, authorizeMediaRead } from "@/features/media/access";
import { getPublicLessonPreview } from "@/features/lessons/preview";
import { previewMediaKeys } from "@/features/lessons/preview-media";
import {
  createPresignedDownload,
  getS3MediaConfig,
  isMediaUploadConfigured,
  parseMediaObjectKey,
} from "@/lib/media/s3";

/** Auth + query-key signing must run per request; never statically prerender. */
export const dynamic = "force-dynamic";

/**
 * Issue a short-lived S3 GET URL after authorization.
 *
 * - Protected kinds (lesson-image, attachment): require canAccessCourse / canManageCourse
 * - Catalog kinds (thumbnail, promo): published course OR course access
 * - Group thumbnails: active bundle catalog OR admin
 *
 * Prefer 302 redirect so <img src="/api/media/file?key=..."> works in lesson HTML.
 * Pass `?redirect=0` to receive JSON `{ downloadUrl, expiresIn }` instead.
 */
export async function GET(request: NextRequest) {
  try {
    if (!isMediaUploadConfigured()) {
      return NextResponse.json(
        { success: false, error: "Media storage is not configured." },
        { status: 503 }
      );
    }

    const config = getS3MediaConfig();
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Media storage is not configured." },
        { status: 503 }
      );
    }

    const key = request.nextUrl.searchParams.get("key")?.trim() || "";
    const redirect = request.nextUrl.searchParams.get("redirect") !== "0";

    const parsed = parseMediaObjectKey(key);
    if (!parsed) {
      return NextResponse.json({ success: false, error: "Invalid media key." }, { status: 400 });
    }

    let allowed = false;
    if (parsed.scope === "group") {
      allowed = await authorizeGroupMediaRead(parsed.groupId);
    } else {
      allowed = await authorizeMediaRead(parsed.courseId, parsed.kind, key);
      if (!allowed) {
        const previewCourseId = request.nextUrl.searchParams.get("previewCourseId");
        const previewLessonId = request.nextUrl.searchParams.get("previewLessonId");
        if (previewCourseId && previewLessonId) {
          const preview = await getPublicLessonPreview(previewCourseId, previewLessonId);
          allowed =
            !!preview && previewMediaKeys(preview, [previewCourseId, preview.media_course_id]).has(key);
        }
      }
    }
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this media." },
        { status: 403 }
      );
    }

    // Public CDN mode: redirect straight to the permanent public URL (no signing).
    if (config.accessMode === "public" && config.publicBaseUrl) {
      const publicUrl = `${config.publicBaseUrl}/${key}`;
      if (redirect) {
        return NextResponse.redirect(publicUrl, 302);
      }
      return NextResponse.json({
        success: true,
        data: { downloadUrl: publicUrl, expiresIn: null, access: "public", key },
      });
    }

    const { downloadUrl, expiresIn } = await createPresignedDownload(key);

    if (redirect) {
      return NextResponse.redirect(downloadUrl, {
        status: 302,
        headers: {
          "Cache-Control": "private, no-store",
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          downloadUrl,
          expiresIn,
          access: "private" as const,
          key,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (err) {
    console.error("[media/file]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to resolve media URL.",
      },
      { status: 500 }
    );
  }
}
