import { NextRequest, NextResponse } from "next/server";
import {
  createPresignedGetForKey,
  getS3MediaConfig,
  isMediaUploadConfigured,
  parseCertificateBackgroundKey,
} from "@/lib/media/s3";

export const dynamic = "force-dynamic";

/**
 * Serve certificate template backgrounds for on-screen preview / verify pages.
 * Public: design assets are meant to appear on certificates (no auth).
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
    if (!parseCertificateBackgroundKey(key)) {
      return NextResponse.json(
        { success: false, error: "Invalid certificate background key." },
        { status: 400 }
      );
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
    console.error("[certificates/background/file]", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error ? err.message : "Failed to resolve background URL.",
      },
      { status: 500 }
    );
  }
}
