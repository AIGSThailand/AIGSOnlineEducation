"use client";

import { useEffect, useState, type RefObject } from "react";
import { CERTIFICATE_PDF_WIDTH_PT } from "@/features/certificates/layout";

/**
 * Tracks certificate preview width so overlay fonts can be scaled to PDF points
 * (fontSizePt * width / A4-landscape-width).
 */
export function useCertificateCanvasScale(
  ref: RefObject<HTMLElement | null>
): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const next = el.getBoundingClientRect().width;
      setWidth((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  if (width <= 0) return 1;
  return width / CERTIFICATE_PDF_WIDTH_PT;
}
