import { NextResponse } from "next/server";
import { canManageCourse } from "@/features/courses/permissions";
import { getCurrentUser } from "@/lib/auth/permissions";
import { createPresignedUpload, isMediaUploadConfigured } from "@/lib/media/s3";
import { presignUploadSchema } from "@/features/media/schema";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    if (!isMediaUploadConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Media upload is not configured. Set AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY. For public mode also set AWS_S3_PUBLIC_BASE_URL (or AWS_CLOUDFRONT_URL). For private paid media set AWS_S3_MEDIA_ACCESS=private.",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = presignUploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message || "Invalid upload request.",
        },
        { status: 400 }
      );
    }

    const { courseId, kind, fileName, contentType } = parsed.data;

    if (!(await canManageCourse(courseId))) {
      return NextResponse.json(
        { success: false, error: "You cannot upload media for this course." },
        { status: 403 }
      );
    }

    const result = await createPresignedUpload({
      courseId,
      kind,
      fileName,
      contentType,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[media/presign]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create upload URL.",
      },
      { status: 500 }
    );
  }
}
