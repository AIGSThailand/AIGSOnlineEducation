/**
 * Phase 2 — download media from a source host and upload to private S3.
 * Does NOT rewrite Postgres (Phase 3).
 *
 * Usage:
 *   npm run migrate:media-s3 -- --host edu.aigsthailand.com --dry-run --limit 20
 *   npm run migrate:media-s3 -- --host edu.aigsthailand.com --write --limit 20
 *   npm run migrate:media-s3 -- --host edu.aigsthailand.com --write
 *
 * Requires inventory JSON from Phase 1 and AWS_* in the env file.
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";
import {
  buildUploadJobs,
  contentTypeForUrl,
  type InventoryAssetLike,
} from "./lib/media-migrate-plan";

type JobResult = {
  sampleUrl: string;
  normalizedUrl: string;
  courseId: string;
  key: string;
  status: "planned" | "uploaded" | "failed" | "skipped_limit";
  bytes?: number;
  contentType?: string;
  error?: string;
  stableUrl?: string;
};

function parseArgs(argv: string[]): {
  host: string;
  dryRun: boolean;
  limit: number | null;
  inventoryPath: string;
  outPath: string;
  concurrency: number;
} {
  const args = stripEnvArgs(argv.filter((a) => a !== "--"));
  const write = args.includes("--write");
  const dryRunFlag = args.includes("--dry-run");
  if (write && dryRunFlag) {
    throw new Error("Pass either --dry-run or --write, not both.");
  }
  const dryRun = !write;

  const hostIdx = args.indexOf("--host");
  const host = hostIdx >= 0 ? args[hostIdx + 1] : "";
  if (!host) {
    throw new Error("Required: --host edu.aigsthailand.com");
  }

  const limitIdx = args.indexOf("--limit");
  const limitRaw = limitIdx >= 0 ? Number(args[limitIdx + 1]) : NaN;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : null;

  const invIdx = args.indexOf("--inventory");
  const outIdx = args.indexOf("--out");
  const concIdx = args.indexOf("--concurrency");
  const concRaw = concIdx >= 0 ? Number(args[concIdx + 1]) : 3;

  return {
    host,
    dryRun,
    limit,
    inventoryPath:
      invIdx >= 0 && args[invIdx + 1]
        ? args[invIdx + 1]
        : path.join("tmp", "media-inventory-2026-09-07.json"),
    outPath:
      outIdx >= 0 && args[outIdx + 1]
        ? args[outIdx + 1]
        : path.join(
            "tmp",
            `media-migrate-${host.replace(/[^a-z0-9.-]+/gi, "_")}-${dryRun ? "dryrun" : "write"}.json`
          ),
    concurrency: Number.isFinite(concRaw) && concRaw > 0 ? Math.min(8, Math.floor(concRaw)) : 3,
  };
}

function resolveInventoryPath(preferred: string): string {
  const abs = path.resolve(process.cwd(), preferred);
  if (fs.existsSync(abs)) return abs;

  const tmpDir = path.resolve(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) {
    throw new Error(`Inventory not found: ${abs}. Run npm run inventory:media first.`);
  }
  const files = fs
    .readdirSync(tmpDir)
    .filter((f) => f.startsWith("media-inventory-") && f.endsWith(".json"))
    .sort()
    .reverse();
  if (!files.length) {
    throw new Error(`Inventory not found: ${abs}. Run npm run inventory:media first.`);
  }
  return path.join(tmpDir, files[0]);
}

function getAwsConfig(): {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
} {
  const region = process.env.AWS_REGION?.trim();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing AWS_REGION / AWS_S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY"
    );
  }
  return { region, bucket, accessKeyId, secretAccessKey };
}

async function downloadBytes(url: string): Promise<{ body: Buffer; contentType: string }> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "AIGS-media-migrate/1.0" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const ab = await res.arrayBuffer();
  const headerType = res.headers.get("content-type")?.split(";")[0]?.trim();
  const contentType =
    headerType && headerType !== "application/octet-stream"
      ? headerType
      : contentTypeForUrl(url);
  return { body: Buffer.from(ab), contentType };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
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

  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const inventoryPath = resolveInventoryPath(opts.inventoryPath);
  console.log(`inventory=${inventoryPath}`);
  const report = JSON.parse(fs.readFileSync(inventoryPath, "utf8")) as {
    assets: InventoryAssetLike[];
  };

  const { jobs: allJobs, skipped } = buildUploadJobs({
    assets: report.assets,
    host: opts.host,
    skipResizedWhenFullExists: true,
  });

  const selected = opts.limit ? allJobs.slice(0, opts.limit) : allJobs;
  console.log(
    JSON.stringify(
      {
        host: opts.host,
        mode: opts.dryRun ? "dry-run" : "write",
        totalJobs: allJobs.length,
        skippedResizedOrOther: skipped.length,
        selected: selected.length,
        limit: opts.limit,
      },
      null,
      2
    )
  );

  const results: JobResult[] = [];

  if (opts.dryRun) {
    for (const job of selected) {
      results.push({
        sampleUrl: job.sampleUrl,
        normalizedUrl: job.normalizedUrl,
        courseId: job.courseId,
        key: job.key,
        status: "planned",
        stableUrl: `/api/media/file?key=${encodeURIComponent(job.key)}`,
      });
    }
  } else {
    const aws = getAwsConfig();
    const client = new S3Client({
      region: aws.region,
      credentials: {
        accessKeyId: aws.accessKeyId,
        secretAccessKey: aws.secretAccessKey,
      },
    });
    console.log(`bucket=${aws.bucket} region=${aws.region} concurrency=${opts.concurrency}`);

    const uploaded = await mapPool(selected, opts.concurrency, async (job) => {
      try {
        const { body, contentType } = await downloadBytes(job.sampleUrl);
        await client.send(
          new PutObjectCommand({
            Bucket: aws.bucket,
            Key: job.key,
            Body: body,
            ContentType: contentType,
          })
        );
        const row: JobResult = {
          sampleUrl: job.sampleUrl,
          normalizedUrl: job.normalizedUrl,
          courseId: job.courseId,
          key: job.key,
          status: "uploaded",
          bytes: body.length,
          contentType,
          stableUrl: `/api/media/file?key=${encodeURIComponent(job.key)}`,
        };
        console.log(`OK ${job.key} (${body.length} bytes)`);
        return row;
      } catch (err) {
        const row: JobResult = {
          sampleUrl: job.sampleUrl,
          normalizedUrl: job.normalizedUrl,
          courseId: job.courseId,
          key: job.key,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
        console.error(`FAIL ${job.sampleUrl} → ${job.key}: ${row.error}`);
        return row;
      }
    });
    results.push(...uploaded);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    phase: 2,
    env: envName,
    host: opts.host,
    dryRun: opts.dryRun,
    inventoryPath,
    notes: [
      "Skipped WordPress -WxH resized files when a full-size sibling exists in inventory.",
      "One S3 object per courseId (shared URLs are uploaded once per course).",
      "No database rewrite in this phase.",
    ],
    summary: {
      totalJobsAvailable: allJobs.length,
      skippedCount: skipped.length,
      skippedResizedHasFull: skipped.filter((s) => s.reason === "resized_has_full").length,
      selected: selected.length,
      planned: results.filter((r) => r.status === "planned").length,
      uploaded: results.filter((r) => r.status === "uploaded").length,
      failed: results.filter((r) => r.status === "failed").length,
      bytesUploaded: results.reduce((n, r) => n + (r.bytes || 0), 0),
    },
    skippedSample: skipped.slice(0, 20),
    results,
  };

  const absOut = path.resolve(process.cwd(), opts.outPath);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(out, null, 2), "utf8");
  console.log("\nSummary", JSON.stringify(out.summary, null, 2));
  console.log(`Wrote ${absOut}`);

  if (!opts.dryRun && out.summary.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
