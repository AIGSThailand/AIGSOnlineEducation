"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trirong } from "next/font/google";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  createCertificateTemplateAction,
  updateCertificateTemplateAction,
  deleteCertificateTemplateAction,
  regenerateTemplateCertificatesAction,
} from "@/features/certificates/actions";
import { formatCertificateDate } from "@/features/certificates/format";
import {
  CERTIFICATE_CONTENT_INSET_PERCENT,
  CERTIFICATE_OVERLAY_LINE_HEIGHT,
  mergeCertificateLayout,
  resolveCertificateBackgroundUrl,
} from "@/features/certificates/layout";
import type {
  CertificateLayoutFont,
  CertificateTemplateDetail,
} from "@/features/certificates/types";
import { uploadCertificateBackground } from "@/features/certificates/upload-client";
import { isMediaUploadAvailable } from "@/features/media/upload-client";
import { useCertificateCanvasScale } from "./use-certificate-canvas-scale";

const trirong = Trirong({
  subsets: ["latin", "latin-ext", "thai"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const HELVETICA = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const BACKGROUND_ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const BACKGROUND_MAX_BYTES = 8 * 1024 * 1024;

type Mode =
  | { kind: "create" }
  | { kind: "edit"; template: CertificateTemplateDetail };

function fieldFontFamily(font: CertificateLayoutFont) {
  return font === "trirong" ? undefined : HELVETICA;
}

export function CertificateTemplateForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = mode.kind === "edit" ? mode.template : null;
  const initial = mergeCertificateLayout(t?.templateData);
  const backgroundInputId = useId();
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const livePreviewRef = useRef<HTMLDivElement>(null);
  const previewScale = useCertificateCanvasScale(livePreviewRef);
  const previewInset = `${CERTIFICATE_CONTENT_INSET_PERCENT}%`;

  const [title, setTitle] = useState(t?.title || "");
  const [slug, setSlug] = useState(t?.slug || "");
  const [description, setDescription] = useState(t?.description || "");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(
    t?.templateData.backgroundImageUrl || ""
  );
  const [nameFontSize, setNameFontSize] = useState(initial.nameFontSize);
  const [nameYPercent, setNameYPercent] = useState(initial.nameYPercent);
  const [nameFont, setNameFont] = useState<CertificateLayoutFont>(initial.nameFont);
  const [showCourseTitle, setShowCourseTitle] = useState(initial.showCourseTitle);
  const [courseFontSize, setCourseFontSize] = useState(initial.courseFontSize);
  const [courseYPercent, setCourseYPercent] = useState(initial.courseYPercent);
  const [courseFont, setCourseFont] = useState<CertificateLayoutFont>(initial.courseFont);
  const [dateFontSize, setDateFontSize] = useState(initial.dateFontSize);
  const [dateYPercent, setDateYPercent] = useState(initial.dateYPercent);
  const [dateFont, setDateFont] = useState<CertificateLayoutFont>(initial.dateFont);
  const [showVerification, setShowVerification] = useState(initial.showVerification);
  const [verificationYPercent, setVerificationYPercent] = useState(
    initial.verificationYPercent
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [regenMsg, setRegenMsg] = useState<string | null>(null);
  const [uploadConfigured, setUploadConfigured] = useState<boolean | null>(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);

  const previewDate = useMemo(() => formatCertificateDate(new Date().toISOString()), []);
  const previewBackgroundUrl = resolveCertificateBackgroundUrl({
    backgroundImageUrl: backgroundImageUrl.trim() || undefined,
  });

  useEffect(() => {
    isMediaUploadAvailable().then(setUploadConfigured);
  }, []);

  function payload() {
    return {
      title,
      slug,
      description,
      backgroundImageUrl: backgroundImageUrl.trim(),
      nameFontSize,
      nameYPercent,
      nameFont,
      showCourseTitle,
      courseFontSize,
      courseYPercent,
      courseFont,
      dateFontSize,
      dateYPercent,
      dateFont,
      showVerification,
      verificationYPercent,
    };
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setRegenMsg(null);
    startTransition(async () => {
      if (mode.kind === "create") {
        const result = await createCertificateTemplateAction(payload());
        if (!result.success) {
          setError(result.error);
          return;
        }
        router.push(`/admin/certificates/${result.data!.id}`);
        return;
      }

      const result = await updateCertificateTemplateAction({
        templateId: mode.template.id,
        ...payload(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function onDelete() {
    if (mode.kind !== "edit") return;
    if (!confirm("Delete this template? Templates with earned certificates cannot be deleted."))
      return;
    startTransition(async () => {
      const result = await deleteCertificateTemplateAction({
        templateId: mode.template.id,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/admin/certificates");
    });
  }

  function onRegenerateAll() {
    if (mode.kind !== "edit") return;
    if (
      !confirm(
        "Regenerate PDFs for all certificates using this template? Requires S3 to be configured."
      )
    )
      return;
    setRegenMsg(null);
    startTransition(async () => {
      const result = await regenerateTemplateCertificatesAction({
        templateId: mode.template.id,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setRegenMsg(
        `Regenerated ${result.data!.regenerated} PDF(s)` +
          (result.data!.failed ? `, ${result.data!.failed} failed` : "") +
          "."
      );
      router.refresh();
    });
  }

  async function onBackgroundFileChange(file: File | undefined) {
    if (!file || mode.kind !== "edit") return;
    setError(null);
    if (!BACKGROUND_ACCEPT.includes(file.type)) {
      setError(`Unsupported type: ${file.type || "unknown"}. Use JPG, PNG, or WebP.`);
      return;
    }
    if (file.size > BACKGROUND_MAX_BYTES) {
      setError("Background image too large (max 8MB).");
      return;
    }

    setUploadingBackground(true);
    try {
      const { publicUrl } = await uploadCertificateBackground({
        templateId: mode.template.id,
        file,
      });
      setBackgroundImageUrl(publicUrl);
      const result = await updateCertificateTemplateAction({
        templateId: mode.template.id,
        ...payload(),
        backgroundImageUrl: publicUrl,
      });
      if (!result.success) {
        setError(result.error || "Uploaded, but failed to save background URL.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Background upload failed.");
    } finally {
      setUploadingBackground(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div>
          <Label htmlFor="cert-title">Title</Label>
          <Input
            id="cert-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Course completion certificate"
          />
        </div>
        <div>
          <Label htmlFor="cert-slug">Slug</Label>
          <Input
            id="cert-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-from-title if empty on create"
          />
        </div>
        <div>
          <Label htmlFor="cert-description">Description</Label>
          <textarea
            id="cert-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">Background image</h3>
          <p className="mt-1 text-xs text-slate-500">
            Landscape A4 JPG/PNG/WebP. Leave empty to use the default AIGS blank. Upload saves
            automatically; then regenerate PDFs for existing certificates.
          </p>
          {mode.kind === "create" ? (
            <p className="mt-2 text-xs text-amber-700">
              Create the template first, then you can upload a custom background.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <input
                ref={backgroundInputRef}
                id={backgroundInputId}
                type="file"
                className="sr-only"
                accept={BACKGROUND_ACCEPT.join(",")}
                disabled={isPending || uploadingBackground || uploadConfigured === false}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  await onBackgroundFileChange(file);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                {uploadConfigured !== false && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending || uploadingBackground || uploadConfigured === null}
                    isLoading={uploadingBackground}
                    onClick={() => backgroundInputRef.current?.click()}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Upload background
                  </Button>
                )}
                {backgroundImageUrl.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending || uploadingBackground}
                    onClick={() => setBackgroundImageUrl("")}
                  >
                    Use default
                  </Button>
                )}
              </div>
              {uploadConfigured === false && (
                <p className="text-xs text-slate-500">
                  S3 upload not configured — paste a CDN/S3 image URL below.
                </p>
              )}
              <div>
                <Label htmlFor="cert-bg-url">Background URL</Label>
                <Input
                  id="cert-bg-url"
                  value={backgroundImageUrl}
                  onChange={(e) => setBackgroundImageUrl(e.target.value)}
                  placeholder="https://… or leave blank for default"
                />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">Layout — name</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="name-size">Font size (px)</Label>
              <Input
                id="name-size"
                type="number"
                min={8}
                max={120}
                value={nameFontSize}
                onChange={(e) => setNameFontSize(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="name-y">Vertical position (%)</Label>
              <Input
                id="name-y"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={nameYPercent}
                onChange={(e) => setNameYPercent(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="name-font">Font</Label>
              <Select
                id="name-font"
                value={nameFont}
                onChange={(e) => setNameFont(e.target.value as CertificateLayoutFont)}
              >
                <option value="trirong">Trirong</option>
                <option value="helvetica">Helvetica Neue</option>
              </Select>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">Layout — course title</h3>
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showCourseTitle}
              onChange={(e) => setShowCourseTitle(e.target.checked)}
            />
            Overlay course title on certificate
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Turn off when the background image already includes the course title.
          </p>
          {showCourseTitle && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="course-size">Font size (px)</Label>
                <Input
                  id="course-size"
                  type="number"
                  min={8}
                  max={120}
                  value={courseFontSize}
                  onChange={(e) => setCourseFontSize(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="course-y">Vertical position (%)</Label>
                <Input
                  id="course-y"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={courseYPercent}
                  onChange={(e) => setCourseYPercent(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="course-font">Font</Label>
                <Select
                  id="course-font"
                  value={courseFont}
                  onChange={(e) => setCourseFont(e.target.value as CertificateLayoutFont)}
                >
                  <option value="trirong">Trirong</option>
                  <option value="helvetica">Helvetica Neue</option>
                </Select>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">Layout — completed date</h3>
          <p className="text-xs text-slate-500">Format: dd MMMM yyyy (e.g. 30 December 2023)</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="date-size">Font size (px)</Label>
              <Input
                id="date-size"
                type="number"
                min={8}
                max={120}
                value={dateFontSize}
                onChange={(e) => setDateFontSize(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="date-y">Vertical position (%)</Label>
              <Input
                id="date-y"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={dateYPercent}
                onChange={(e) => setDateYPercent(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="date-font">Font</Label>
              <Select
                id="date-font"
                value={dateFont}
                onChange={(e) => setDateFont(e.target.value as CertificateLayoutFont)}
              >
                <option value="trirong">Trirong</option>
                <option value="helvetica">Helvetica Neue</option>
              </Select>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showVerification}
              onChange={(e) => setShowVerification(e.target.checked)}
            />
            Show verification code on certificate
          </label>
          {showVerification && (
            <div className="mt-3 max-w-xs">
              <Label htmlFor="verify-y">Verification vertical position (%)</Label>
              <Input
                id="verify-y"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={verificationYPercent}
                onChange={(e) => setVerificationYPercent(Number(e.target.value))}
              />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Layout saved.</p>}
        {regenMsg && <p className="text-sm text-green-600">{regenMsg}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isPending || uploadingBackground}>
            {isPending ? "Saving…" : mode.kind === "create" ? "Create template" : "Save layout"}
          </Button>
          {mode.kind === "edit" && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={onRegenerateAll}
              >
                Regenerate all PDFs
              </Button>
              <Button type="button" variant="outline" disabled={isPending} onClick={onDelete}>
                Delete
              </Button>
            </>
          )}
        </div>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Live preview</h3>
        <p className="mb-2 text-xs text-slate-500">
          Fonts scale to match PDF A4 landscape — positions should match regenerated PDFs.
        </p>
        <div
          ref={livePreviewRef}
          className="relative mx-auto aspect-[1.414/1] w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 shadow-sm"
          style={{
            backgroundImage: `url(${previewBackgroundUrl})`,
            backgroundSize: "100% 100%",
          }}
        >
          <p
            className={`absolute text-center text-slate-900 ${
              nameFont === "trirong" ? trirong.className : ""
            }`}
            style={{
              left: previewInset,
              right: previewInset,
              top: `${nameYPercent}%`,
              fontSize: nameFontSize * previewScale,
              lineHeight: CERTIFICATE_OVERLAY_LINE_HEIGHT,
              fontFamily: fieldFontFamily(nameFont),
            }}
          >
            Sample Student Name
          </p>
          {showCourseTitle && (
            <p
              className={`absolute text-center text-slate-900 ${
                courseFont === "trirong" ? trirong.className : ""
              }`}
              style={{
                left: previewInset,
                right: previewInset,
                top: `${courseYPercent}%`,
                fontSize: courseFontSize * previewScale,
                lineHeight: CERTIFICATE_OVERLAY_LINE_HEIGHT,
                fontFamily: fieldFontFamily(courseFont),
              }}
            >
              Sample Course Title
            </p>
          )}
          <p
            className={`absolute text-center text-slate-900 ${
              dateFont === "trirong" ? trirong.className : ""
            }`}
            style={{
              left: previewInset,
              right: previewInset,
              top: `${dateYPercent}%`,
              fontSize: dateFontSize * previewScale,
              lineHeight: CERTIFICATE_OVERLAY_LINE_HEIGHT,
              fontFamily: fieldFontFamily(dateFont),
            }}
          >
            {previewDate}
          </p>
          {showVerification && (
            <p
              className="absolute text-center font-mono text-slate-500"
              style={{
                left: previewInset,
                right: previewInset,
                top: `${verificationYPercent}%`,
                fontSize: 8 * previewScale,
                lineHeight: CERTIFICATE_OVERLAY_LINE_HEIGHT,
              }}
            >
              Verification: ABC12DEF34
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
