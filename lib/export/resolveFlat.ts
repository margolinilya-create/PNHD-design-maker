// Единый резолвер флэта для экспорта/превью: SVG (seed-путь или data URL)
// → векторная разметка; растровый флэт (PNG/JPEG data URL — напр. из
// загруженной PDF/AI-визуалки) → data URL для <image> + габариты из
// natural-размера × scale_mm_per_unit.
"use client";

import { resolveFlatMarkup } from "./flatMarkup";

export interface ResolvedFlat {
  /** SVG-разметка флэта («» для растрового). */
  markup: string;
  /** data URL растрового флэта — рисуется <image> вместо inner-SVG. */
  rasterUrl?: string;
  /** Габариты флэта в мм (единицы × scale_mm_per_unit). */
  flatMm: { w: number; h: number };
}

const RASTER_DATA_URL = /^data:image\/(png|jpe?g)/i;

/** Размер SVG в мм по viewBox (для сцены PDF). */
export function svgSizeMm(markup: string): { w: number; h: number } {
  const vb = markup.match(
    /viewBox\s*=\s*["']\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)/i,
  );
  if (vb) return { w: parseFloat(vb[3]), h: parseFloat(vb[4]) };
  return { w: 600, h: 760 };
}

function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((res, rej) => {
    const img = new window.Image();
    img.onload = () => res({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => rej(new Error("Не удалось прочитать растровый флэт"));
    img.src = src;
  });
}

export async function resolveFlat(
  flatRef: string,
  scaleMmPerUnit: number,
): Promise<ResolvedFlat> {
  if (RASTER_DATA_URL.test(flatRef)) {
    const px = await imageSize(flatRef);
    return {
      markup: "",
      rasterUrl: flatRef,
      flatMm: { w: px.w * scaleMmPerUnit, h: px.h * scaleMmPerUnit },
    };
  }
  const markup = await resolveFlatMarkup(flatRef);
  const raw = svgSizeMm(markup);
  return {
    markup,
    flatMm: { w: raw.w * scaleMmPerUnit, h: raw.h * scaleMmPerUnit },
  };
}
