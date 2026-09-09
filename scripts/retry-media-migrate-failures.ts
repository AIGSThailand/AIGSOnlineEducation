/**
 * Retry Phase 2 failures from a migrate manifest.
 * Tries the original URL, then WordPress REST media search for same filename
 * (official source_url alts only — no path guessing).
 *
 * Usage:
 *   npm run migrate:media-s3:retry -- --env local
 *   npm run migrate:media-s3:retry -- --env local --manifest tmp/media-migrate-edu.aigsthailand.com-write.json
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";
import { contentTypeForUrl } from "./lib/media-migrate-plan";

type FailedJob = {
  sampleUrl: string;
  normalizedUrl: string;
  courseId: string;
  key: string;
  status: string;
  error?: string;
};

function parseArgs(argv: string[]) {
  const args = stripEnvArgs(argv.filter((a) => a !== "--"));
  const mIdx = args.indexOf("--manifest");
  const outIdx = args.indexOf("--out");
  // Default: write. Pass --dry-run to resolve URLs only.
  const dryRun = args.includes("--dry-run");
  return {
    dryRun,
    manifestPath:
      mIdx >= 0 && args[mIdx + 1]
        ? args[mIdx + 1]
        : path.join("tmp", "media-migrate-edu.aigsthailand.com-write.json"),
    outPath:
      outIdx >= 0 && args[outIdx + 1]
        ? args[outIdx + 1]
        : path.join("tmp", "media-migrate-retry.json"),
  };
}

async function headOk(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "AIGS-media-migrate-retry/1.0" },
    });
    return r.status === 200;
  } catch {
    return false;
  }
}

async function downloadBytes(url: string): Promise<{ body: Buffer; contentType: string }> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "AIGS-media-migrate-retry/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  const headerType = res.headers.get("content-type")?.split(";")[0]?.trim();
  const contentType =
    headerType && headerType !== "application/octet-stream"
      ? headerType
      : contentTypeForUrl(url);
  return { body: Buffer.from(ab), contentType };
}

/** Official WP REST alts that share the same filename. */
async function findWpSourceAlts(sampleUrl: string): Promise<string[]> {
  let fileName: string;
  try {
    fileName = decodeURIComponent(new URL(sampleUrl).pathname.split("/").pop() || "");
  } catch {
    return [];
  }
  if (!fileName) return [];

  const ascii = (fileName.match(/[A-Za-z0-9]{3,}/g) || []).slice(0, 4).join(" ");
  const thai = fileName.replace(/\.pdf$/i, "").slice(0, 24);
  const queries = [...new Set([ascii, thai].filter((q) => q.trim().length >= 3))];
  const found = new Set<string>();

  for (const q of queries) {
    const api = `https://edu.aigsthailand.com/wp-json/wp/v2/media?search=${encodeURIComponent(q)}&per_page=20`;
    try {
      const r = await fetch(api, {
        headers: { "User-Agent": "AIGS-media-migrate-retry/1.0" },
      });
      if (!r.ok) continue;
      const items = (await r.json()) as Array<{ source_url?: string }>;
      for (const item of items) {
        const src = item.source_url;
        if (!src) continue;
        let srcName = "";
        try {
          srcName = decodeURIComponent(new URL(src).pathname.split("/").pop() || "");
        } catch {
          continue;
        }
        if (srcName === fileName) found.add(src);
      }
    } catch {
      /* ignore */
    }
  }

  return [...found];
}

async function resolveDownloadUrl(sampleUrl: string): Promise<{
  downloadUrl: string | null;
  tried: string[];
}> {
  const tried: string[] = [sampleUrl];
  if (await headOk(sampleUrl)) {
    return { downloadUrl: sampleUrl, tried };
  }

  const alts = (await findWpSourceAlts(sampleUrl)).filter((u) => u !== sampleUrl);
  for (const alt of alts) {
    tried.push(alt);
    if (await headOk(alt)) {
      return { downloadUrl: alt, tried };
    }
  }

  return { downloadUrl: null, tried };
}

async function main(): Promise<void> {
  let envName: string;
  try {
    envName = parseEnvFlag(process.argv);
    const loaded = loadCliEnv(envName);
    console.log(`env file=${loaded.filePath} (--env ${envName})`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const opts = parseArgs(process.argv.slice(2));
  const dryRun = opts.dryRun;

  const manifestPath = path.resolve(process.cwd(), opts.manifestPath);
  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    results: FailedJob[];
  };
  const fails = manifest.results.filter((r) => r.status === "failed");
  console.log(`failures=${fails.length} mode=${dryRun ? "dry-run" : "write"}`);

  const region = process.env.AWS_REGION?.trim();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!dryRun && (!region || !bucket || !accessKeyId || !secretAccessKey)) {
    console.error("Missing AWS credentials in env");
    process.exit(1);
  }

  const client =
    !dryRun && region && accessKeyId && secretAccessKey
      ? new S3Client({
          region,
          credentials: { accessKeyId, secretAccessKey },
        })
      : null;

  const results: Array<Record<string, unknown>> = [];

  for (const job of fails) {
    const fileName = decodeURIComponent(job.sampleUrl.split("/").pop() || "");
    process.stdout.write(`\n→ ${fileName}\n`);
    const resolved = await resolveDownloadUrl(job.sampleUrl);
    console.log(`  tried=${resolved.tried.length} download=${resolved.downloadUrl || "(none)"}`);

    if (!resolved.downloadUrl) {
      results.push({
        ...job,
        status: "still_missing",
        tried: resolved.tried,
        error: "HTTP 404 on original and WP REST alts",
      });
      continue;
    }

    if (dryRun) {
      results.push({
        ...job,
        status: "would_upload",
        downloadUrl: resolved.downloadUrl,
        tried: resolved.tried,
      });
      continue;
    }

    try {
      const { body, contentType } = await downloadBytes(resolved.downloadUrl);
      await client!.send(
        new PutObjectCommand({
          Bucket: bucket!,
          Key: job.key,
          Body: body,
          ContentType: contentType,
        })
      );
      console.log(`  OK ${job.key} (${body.length} bytes)`);
      results.push({
        ...job,
        status: "uploaded",
        downloadUrl: resolved.downloadUrl,
        bytes: body.length,
        contentType,
        tried: resolved.tried,
        stableUrl: `/api/media/file?key=${encodeURIComponent(job.key)}`,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL ${error}`);
      results.push({
        ...job,
        status: "failed",
        downloadUrl: resolved.downloadUrl,
        tried: resolved.tried,
        error,
      });
    }
  }

  const summary = {
    total: fails.length,
    uploaded: results.filter((r) => r.status === "uploaded").length,
    wouldUpload: results.filter((r) => r.status === "would_upload").length,
    stillMissing: results.filter((r) => r.status === "still_missing").length,
    failed: results.filter((r) => r.status === "failed").length,
  };

  const out = {
    generatedAt: new Date().toISOString(),
    env: envName,
    dryRun,
    sourceManifest: manifestPath,
    summary,
    results,
  };

  const absOut = path.resolve(process.cwd(), opts.outPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(out, null, 2), "utf8");
  console.log("\nSummary", JSON.stringify(summary, null, 2));
  console.log(`Wrote ${absOut}`);

  // Print readable list
  console.log("\nStill missing:");
  for (const r of results.filter((x) => x.status === "still_missing")) {
    console.log(` - ${r.sampleUrl}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
