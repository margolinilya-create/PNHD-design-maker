// Общие примитивы чтения размеров SVG и изображений.
// ВАЖНО: интерпретация значений различается по месту использования:
// - макеты (loadAsset): width/height с физическими единицами приоритетнее
//   viewBox, viewBox-only — оценка (флаг estimated);
// - флэты (resolveFlat): viewBox по конвенции = мм (flat-svg-convention).
// Здесь — только извлечение чисел, без интерпретации.
"use client";

/**
 * Парсит viewBox SVG → ширина/высота в юнитах viewBox (3-й и 4-й компоненты).
 * null — атрибут не найден. Валидность значений (> 0) проверяет вызывающий.
 */
export function parseViewBox(
  svgText: string,
): { w: number; h: number } | null {
  const vb = svgText.match(
    /viewBox\s*=\s*["']\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)/i,
  );
  if (!vb) return null;
  return { w: parseFloat(vb[3]), h: parseFloat(vb[4]) };
}

/**
 * Natural-размер изображения по src (data URL или путь). Нулевые размеры
 * заменяются на 1 (защита от деления на ноль).
 */
export function imageNaturalSize(
  src: string,
  errorMessage = "Не удалось прочитать изображение",
): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () =>
      resolve({
        naturalWidth: img.naturalWidth || 1,
        naturalHeight: img.naturalHeight || 1,
      });
    img.onerror = () => reject(new Error(errorMessage));
    img.src = src;
  });
}
