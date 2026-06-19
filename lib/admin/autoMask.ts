// Авто-генерация маски ткани из фото по яркости (для перекраски превью).
// Предикат «светлый пиксель = ткань» — для светлой базы на контрастном фоне.
// Маска: white=ткань (тинт виден), black=фон. Можно инвертировать.
"use client";

/** Яркость по Rec.601. */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Светлый ли пиксель относительно порога (0..255). */
export function isLightPixel(
  r: number,
  g: number,
  b: number,
  threshold: number,
): boolean {
  return luminance(r, g, b) >= threshold;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось прочитать фото"));
    img.src = src;
  });
}

/**
 * Сгенерировать маску ткани из фото: пиксели ярче порога → белые (ткань),
 * иначе чёрные. `invert` — если ткань темнее фона. Возвращает PNG data URL.
 */
export async function generateMaskFromPhoto(
  photoDataUrl: string,
  threshold = 150,
  invert = false,
): Promise<string> {
  const img = await loadImg(photoDataUrl);
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D недоступен");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    let on = isLightPixel(px[i], px[i + 1], px[i + 2], threshold);
    if (invert) on = !on;
    const v = on ? 255 : 0;
    px[i] = v;
    px[i + 1] = v;
    px[i + 2] = v;
    px[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}
