// Качество печати растрового макета по эффективному DPI на текущем размере печати.
// SVG (вектор) — без потери качества. (BUILD.md решение #6: предупреждать, не блокировать.)
import type { Asset } from "@/types";

export const DPI_GOOD = 300;
export const DPI_MIN = 150;

export type PrintQuality = "vector" | "good" | "mid" | "low" | "unknown";

/** Эффективный DPI: пиксели исходника на текущей ширине печати (мм). */
export function effectiveDpi(pxWidth: number, printWidthMm: number): number {
  if (!(pxWidth > 0) || !(printWidthMm > 0)) return 0;
  return (pxWidth * 25.4) / printWidthMm;
}

export interface QualityInfo {
  quality: PrintQuality;
  dpi?: number;
}

/** Качество печати ассета при заданной ширине печати (мм). */
export function printQuality(
  asset: Asset | undefined,
  printWidthMm: number,
): QualityInfo {
  if (!asset) return { quality: "unknown" };
  if (asset.type === "svg") return { quality: "vector" };
  if (!asset.px_width) return { quality: "unknown" };
  const dpi = effectiveDpi(asset.px_width, printWidthMm);
  const quality: PrintQuality =
    dpi >= DPI_GOOD ? "good" : dpi >= DPI_MIN ? "mid" : "low";
  return { quality, dpi };
}
