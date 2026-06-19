// Курированная библиотека Pantone (Solid Coated) — для spot-методов
// (шелкография/вышивка). Не полный фан, а частые в мерче цвета. hex —
// приблизительная экранная аппроксимация; источник правды — код PMS.
export interface PantoneSwatch {
  code: string; // напр. "PMS 186 C"
  hex: string;
}

export const PANTONE_SWATCHES: PantoneSwatch[] = [
  { code: "PMS Black C", hex: "#2d2926" },
  { code: "PMS White", hex: "#ffffff" },
  { code: "PMS Cool Gray 9 C", hex: "#75787b" },
  { code: "PMS 186 C", hex: "#c8102e" },
  { code: "PMS 200 C", hex: "#ba0c2f" },
  { code: "PMS 485 C", hex: "#da291c" },
  { code: "PMS 021 C", hex: "#fe5000" },
  { code: "PMS 137 C", hex: "#ffa300" },
  { code: "PMS Yellow C", hex: "#fedd00" },
  { code: "PMS 355 C", hex: "#009639" },
  { code: "PMS 347 C", hex: "#009a44" },
  { code: "PMS 3275 C", hex: "#00b2a9" },
  { code: "PMS 285 C", hex: "#0072ce" },
  { code: "PMS 286 C", hex: "#0033a0" },
  { code: "PMS 072 C", hex: "#10069f" },
  { code: "PMS 2685 C", hex: "#330072" },
  { code: "PMS 254 C", hex: "#a41f87" },
  { code: "PMS 213 C", hex: "#e0008a" },
  { code: "PMS 4625 C", hex: "#4e2c1d" },
  { code: "PMS 7503 C", hex: "#a39161" },
  { code: "PMS 877 C (Silver)", hex: "#a7a8aa" },
  { code: "PMS 871 C (Gold)", hex: "#84754e" },
];

const byCode = new Map(PANTONE_SWATCHES.map((s) => [s.code, s]));

/** Hex по коду PMS (для экранной аппроксимации); undefined — нет в библиотеке. */
export function pantoneHex(code: string): string | undefined {
  return byCode.get(code)?.hex;
}
