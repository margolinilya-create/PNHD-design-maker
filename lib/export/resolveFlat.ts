// Единый резолвер флэта для экспорта/превью: SVG (seed-путь или data URL)
// → векторная разметка; растровый флэт (PNG/JPEG data URL — напр. из
// загруженной PDF/AI-визуалки) → data URL для <image> + габариты из
// natural-размера × scale_mm_per_unit.
"use client";

import { resolveFlatMarkup } from "./flatMarkup";
import { parseViewBox, imageNaturalSize } from "@/lib/catalog/svgMeta";

export interface ResolvedFlat {
  /** SVG-разметка флэта («» для растрового). */
  markup: string;
  /** data URL растрового флэта — рисуется <image> вместо inner-SVG. */
  rasterUrl?: string;
  /** Габариты флэта в мм (единицы × scale_mm_per_unit). */
  flatMm: { w: number; h: number };
}

const RASTER_DATA_URL = /^data:image\/(png|jpe?g)/i;

/** Размер SVG в мм по viewBox (для сцены PDF): по конвенции флэтов 1 unit = 1 мм. */
export function svgSizeMm(markup: string): { w: number; h: number } {
  return parseViewBox(markup) ?? { w: 600, h: 760 };
}

async function imageSize(src: string): Promise<{ w: number; h: number }> {
  const n = await imageNaturalSize(src, "Не удалось прочитать растровый флэт");
  return { w: n.naturalWidth, h: n.naturalHeight };
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
