import { NextResponse } from "next/server";
import { certificateBackgroundPresignSchema } from "@/features/certificates/schema";
import { getCurrentUser } from "@/lib/auth/permissions";
import {
  createPresignedCertificateBackgroundUpload,
  isMediaUploadConfigured,
} from "@/lib/media/s3";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.profile?.role !== "admin") {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    if (!isMediaUploadConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Media upload is not configured. Set AWS_REGION, AWS_S3_BUCKET, and credentials.",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = certificateBackgroundPresignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message || "Invalid upload request.",
        },
        { status: 400 }
      );
    }

    const { templateId, fileName, contentType } = parsed.data;

    const supabase = await createClient();
    const { data: template, error } = await supabase
      .from("certificate_templates")
      .select("id")
      .eq("id", templateId)
      .maybeSingle<{ id: string }>();

    if (error || !template) {
      return NextResponse.json(
        { success: false, error: "Certificate template not found." },
        { status: 404 }
      );
    }

    const result = await createPresignedCertificateBackgroundUpload({
      templateId,
      fileName,
      contentType,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[certificates/background/presign]", err);
    const message = err instanceof Error ? err.message : "Failed to create upload URL.";
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
