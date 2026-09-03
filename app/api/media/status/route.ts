import { NextResponse } from "next/server";
import { isMediaUploadConfigured } from "@/lib/media/s3";

/** Lightweight probe for the builder UI (no secrets). */
export async function GET() {
  return NextResponse.json({
    configured: isMediaUploadConfigured(),
  });
}
