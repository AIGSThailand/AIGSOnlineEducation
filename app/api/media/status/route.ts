import { NextResponse } from "next/server";
import { getS3MediaConfig, isMediaUploadConfigured } from "@/lib/media/s3";

/** Lightweight probe for the builder UI (no secrets). */
export async function GET() {
  const config = getS3MediaConfig();
  return NextResponse.json({
    configured: isMediaUploadConfigured(),
    access: config?.accessMode ?? null,
  });
}
