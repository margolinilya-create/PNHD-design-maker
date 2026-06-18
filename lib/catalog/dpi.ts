// Качество печати макета на текущем размере печати. Пороги зависят от метода
// (S1.1): DTF/шелкография — по эффективному DPI; вышивка — по минимальной детали.
// SVG (вектор) — без потери качества. (BUILD.md решение #6: предупреждать, не блокировать.)
import type { Asset, PrintMethod } from "@/types";
import { printMethodProfile } from "@/lib/catalog/printMethod";

// Дефолтные пороги (профиль DTF) — для обратной совместимости.
export const DPI_GOOD = 300;
export const DPI_MIN = 150;

export type PrintQuality =
  | "vector"
  | "good"
  | "mid"
  | "low"
  | "embroidery"
  | "unknown";

/** Эффективный DPI: пиксели исходника на текущей ширине печати (мм). */
export function effectiveDpi(pxWidth: number, printWidthMm: number): number {
  if (!(pxWidth > 0) || !(printWidthMm > 0)) return 0;
  return (pxWidth * 25.4) / printWidthMm;
}

export interface QualityInfo {
  quality: PrintQuality;
  dpi?: number;
}

/**
 * Качество печати ассета при заданной ширине печати (мм) для метода.
 * Метод по умолчанию — DTF (пороги 300/150, как раньше).
 */
export function printQuality(
  asset: Asset | undefined,
  printWidthMm: number,
  method?: PrintMethod,
): QualityInfo {
  if (!asset) return { quality: "unknown" };
  const profile = printMethodProfile(method);
  // Вышивка — диджитайз вне инструмента: контроль не по DPI, а по детали.
  if (profile.detail) return { quality: "embroidery" };
  if (asset.type === "svg") return { quality: "vector" };
  if (!asset.px_width) return { quality: "unknown" };
  const dpi = effectiveDpi(asset.px_width, printWidthMm);
  const { good, min } = profile.dpi ?? { good: DPI_GOOD, min: DPI_MIN };
  const quality: PrintQuality = dpi >= good ? "good" : dpi >= min ? "mid" : "low";
  return { quality, dpi };
}
