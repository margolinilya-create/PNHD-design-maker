// Профили методов печати (S1.1). Каждый метод задаёт режим цвета, релевантность
// Pantone и модель контроля качества: по DPI (DTF/шелкография) либо по минимальной
// прошиваемой детали (вышивка). Источник правды для подготовки к печати и экспорта.
import type { PrintMethod } from "@/types";

export type ColorMode = "cmyk" | "spot";

export interface PrintMethodProfile {
  id: PrintMethod;
  /** Полное имя (ru). */
  label: string;
  /** Короткая метка для бейджей. */
  short: string;
  colorMode: ColorMode;
  /** Релевантны ли spot/Pantone-цвета (шелкография/вышивка — да, DTF — нет). */
  pantone: boolean;
  /** Контроль качества растрового макета по эффективному DPI. */
  dpi?: { good: number; min: number };
  /** Контроль по минимальной прошиваемой детали в мм (вышивка вместо DPI). */
  detail?: { minLineMm: number; minTextMm: number };
}

export const PRINT_METHODS: Record<PrintMethod, PrintMethodProfile> = {
  dtf: {
    id: "dtf",
    label: "DTF-трансфер",
    short: "DTF",
    colorMode: "cmyk",
    pantone: false,
    dpi: { good: 300, min: 150 },
  },
  screenprint: {
    id: "screenprint",
    label: "Шелкография",
    short: "Шёлк",
    colorMode: "spot",
    pantone: true,
    // Линарт/плашки терпимее к разрешению, чем фотопечать.
    dpi: { good: 200, min: 120 },
  },
  embroidery: {
    id: "embroidery",
    label: "Вышивка",
    short: "Вышивка",
    colorMode: "spot",
    pantone: true,
    // Диджитайз вне инструмента; контролируем минимальную деталь.
    detail: { minLineMm: 1, minTextMm: 4 },
  },
};

export const DEFAULT_PRINT_METHOD: PrintMethod = "dtf";

export const PRINT_METHOD_LIST: PrintMethodProfile[] = Object.values(PRINT_METHODS);

/** Профиль метода с фоллбэком на DTF. */
export function printMethodProfile(
  m: PrintMethod | undefined,
): PrintMethodProfile {
  return (m && PRINT_METHODS[m]) || PRINT_METHODS[DEFAULT_PRINT_METHOD];
}

/**
 * Эффективный метод нанесения: явный на нанесении → дефолт зоны → DTF.
 */
export function resolveMethod(
  placementMethod: PrintMethod | undefined,
  areaDefault: PrintMethod | undefined,
): PrintMethod {
  return placementMethod ?? areaDefault ?? DEFAULT_PRINT_METHOD;
}
