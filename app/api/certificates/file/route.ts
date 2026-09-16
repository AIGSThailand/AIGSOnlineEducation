import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import {
  createPresignedGetForKey,
  getS3MediaConfig,
  isMediaUploadConfigured,
  parseCertificateObjectKey,
} from "@/lib/media/s3";

export const dynamic = "force-dynamic";

/**
 * Short-lived download for certificate PDFs stored under certificates/{earnedId}/…
 * Allowed for certificate owner or admin.
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
    const parsed = parseCertificateObjectKey(key);
    if (!parsed) {
      return NextResponse.json({ success: false, error: "Invalid certificate key." }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: earned, error } = await supabase
      .from("earned_certificates")
      .select("id, student_id")
      .eq("id", parsed.earnedId)
      .maybeSingle<{ id: string; student_id: string }>();

    if (error || !earned) {
      return NextResponse.json({ success: false, error: "Certificate not found." }, { status: 404 });
    }

    const isOwner = earned.student_id === user.id;
    const isAdmin = user.profile?.role === "admin";
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    if (config.accessMode === "public" && config.publicBaseUrl) {
      return NextResponse.redirect(`${config.publicBaseUrl}/${key}`, 302);
    }

    const { downloadUrl } = await createPresignedGetForKey(key);
    return NextResponse.redirect(downloadUrl, {
      status: 302,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    console.error("[certificates/file]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to resolve certificate URL.",
      },
      { status: 500 }
    );
  }
}
