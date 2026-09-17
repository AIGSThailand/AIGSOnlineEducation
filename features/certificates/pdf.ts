import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import type { CertificateLayoutFont, CertificateTemplateData } from "./types";
import { formatCertificateDate } from "./format";
import {
  DEFAULT_CERTIFICATE_BACKGROUND_URL,
  mergeCertificateLayout,
  resolveCertificateBackgroundUrl,
} from "./layout";
import { containsCjk, splitTextRuns } from "./text-runs";
import {
  getCertificateBackgroundObjectBuffer,
  parseCertificateBackgroundKey,
} from "@/lib/media/s3";

export type CertificatePdfInput = {
  templateTitle: string;
  templateData: CertificateTemplateData;
  studentName: string;
  courseTitle: string;
  earnedAt: string;
  verificationCode: string;
};

/** Official AIGS landscape blank used as the PDF page background. */
export function getCertificateTemplateImagePath(): string {
  return path.join(process.cwd(), "public", "certificates", "aigs-online-template.jpg");
}

function fontPath(fileName: string): string {
  return path.join(process.cwd(), "public", "certificates", "fonts", fileName);
}

type FontRegistry = {
  trirong: boolean;
  notoSc: boolean;
};

function resolveLatinFont(font: CertificateLayoutFont, fonts: FontRegistry): string {
  if (font === "trirong" && fonts.trirong) return "Trirong";
  return "Helvetica";
}

function resolveRunFont(cjk: boolean, preferred: CertificateLayoutFont, fonts: FontRegistry): string {
  if (cjk) {
    // Helvetica/Trirong have no CJK glyphs — always use Noto Sans SC when available.
    return fonts.notoSc ? "NotoSansSC" : resolveLatinFont(preferred, fonts);
  }
  return resolveLatinFont(preferred, fonts);
}

/**
 * Draw centered text, switching fonts per CJK / Latin run so Chinese course titles render.
 * Auto-shrinks if the line exceeds maxWidth.
 */
function drawCenteredMixedText(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  centerX: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  preferred: CertificateLayoutFont,
  fonts: FontRegistry
) {
  const runs = splitTextRuns(text);
  let size = fontSize;

  const measure = (s: number) => {
    let total = 0;
    const widths: number[] = [];
    for (const run of runs) {
      doc.font(resolveRunFont(run.cjk, preferred, fonts)).fontSize(s);
      const w = doc.widthOfString(run.text);
      widths.push(w);
      total += w;
    }
    return { total, widths };
  };

  let { total, widths } = measure(size);
  while (total > maxWidth && size > 12) {
    size -= 2;
    ({ total, widths } = measure(size));
  }

  // Soft-wrap to a second line if still too wide after shrink
  if (total > maxWidth && text.includes(" – ")) {
    const [left, right] = text.split(" – ");
    drawCenteredMixedText(
      doc,
      left.trim(),
      centerX,
      y,
      maxWidth,
      size,
      preferred,
      fonts
    );
    drawCenteredMixedText(
      doc,
      right.trim(),
      centerX,
      y + size * 1.25,
      maxWidth,
      size,
      preferred,
      fonts
    );
    return;
  }

  let x = centerX - total / 2;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    doc
      .font(resolveRunFont(run.cjk, preferred, fonts))
      .fontSize(size)
      .fillColor("#1a1a1a")
      .text(run.text, x, y, { lineBreak: false, continued: false });
    x += widths[i];
  }
}

function publicPathFromUrl(url: string): string | null {
  if (!url.startsWith("/")) return null;
  const withoutQuery = url.split("?")[0] || url;
  if (withoutQuery.includes("..")) return null;
  return path.join(process.cwd(), "public", withoutQuery.replace(/^\//, ""));
}

/**
 * Resolve the background image for PDFKit: local default, S3 key buffer, or remote fetch.
 */
export async function resolveCertificateBackgroundSource(
  templateData?: CertificateTemplateData | null
): Promise<string | Buffer> {
  const url = resolveCertificateBackgroundUrl(templateData);

  if (!url || url === DEFAULT_CERTIFICATE_BACKGROUND_URL) {
    const local = getCertificateTemplateImagePath();
    if (!fs.existsSync(local)) {
      throw new Error(`Certificate template image missing at ${local}`);
    }
    return local;
  }

  // App-relative public asset (e.g. /certificates/…)
  const localFromPublic = publicPathFromUrl(url);
  if (localFromPublic && fs.existsSync(localFromPublic)) {
    return localFromPublic;
  }

  // Private-mode app proxy → load directly from S3
  try {
    const parsedUrl = url.startsWith("http")
      ? new URL(url)
      : new URL(url, "http://localhost");
    if (parsedUrl.pathname.includes("/api/certificates/background/file")) {
      const key = parsedUrl.searchParams.get("key")?.trim() || "";
      if (parseCertificateBackgroundKey(key)) {
        const buffer = await getCertificateBackgroundObjectBuffer(key);
        if (buffer) return buffer;
      }
    }
  } catch {
    // fall through to HTTP fetch
  }

  // Absolute CDN / external URL
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download certificate background (${res.status}).`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  // Relative proxy path without host
  if (url.startsWith("/api/certificates/background/file")) {
    const key = new URL(url, "http://localhost").searchParams.get("key")?.trim() || "";
    if (parseCertificateBackgroundKey(key)) {
      const buffer = await getCertificateBackgroundObjectBuffer(key);
      if (buffer) return buffer;
    }
  }

  throw new Error(`Could not load certificate background: ${url}`);
}

/**
 * Generate a landscape A4 certificate PDF using the template background image,
 * overlaying student name, course title, and completion date from template layout.
 * Chinese / CJK in names or titles uses Noto Sans SC.
 */
export async function generateCertificatePdf(input: CertificatePdfInput): Promise<Buffer> {
  const background = await resolveCertificateBackgroundSource(input.templateData);

  const layout = mergeCertificateLayout(input.templateData);
  const trirongRegular = fontPath("Trirong-Regular.ttf");
  const notoSc = fontPath("NotoSansSC-Regular.woff");
  const fonts: FontRegistry = {
    trirong: fs.existsSync(trirongRegular),
    notoSc: fs.existsSync(notoSc),
  };

  if (containsCjk(`${input.studentName} ${input.courseTitle}`) && !fonts.notoSc) {
    console.warn(
      "[generateCertificatePdf] CJK text present but NotoSansSC-Regular.woff is missing; glyphs may be blank."
    );
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (fonts.trirong) {
      doc.registerFont("Trirong", trirongRegular);
    }
    if (fonts.notoSc) {
      doc.registerFont("NotoSansSC", notoSc);
    }

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    doc.image(background, 0, 0, {
      width: pageWidth,
      height: pageHeight,
    });

    const contentWidth = pageWidth * 0.72;
    const contentX = pageWidth / 2;

    const nameY = pageHeight * (layout.nameYPercent / 100);
    drawCenteredMixedText(
      doc,
      input.studentName || "Student",
      contentX,
      nameY,
      contentWidth,
      layout.nameFontSize,
      layout.nameFont,
      fonts
    );

    if (layout.showCourseTitle) {
      const courseY = pageHeight * (layout.courseYPercent / 100);
      drawCenteredMixedText(
        doc,
        input.courseTitle || input.templateTitle,
        contentX,
        courseY,
        contentWidth,
        layout.courseFontSize,
        layout.courseFont,
        fonts
      );
    }

    const dateLabel = formatCertificateDate(input.earnedAt);
    const dateY = pageHeight * (layout.dateYPercent / 100);
    if (dateLabel) {
      drawCenteredMixedText(
        doc,
        dateLabel,
        contentX,
        dateY,
        contentWidth,
        layout.dateFontSize,
        layout.dateFont,
        fonts
      );
    }

    if (layout.showVerification) {
      const verifyY = pageHeight * (layout.verificationYPercent / 100);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#666666")
        .text(`Verification: ${input.verificationCode}`, contentX - contentWidth / 2, verifyY, {
          width: contentWidth,
          align: "center",
        });
    }

    doc.end();
  });
}
