// Растеризация SVG-разметки в PNG и скачивание.
"use client";

import { svgToDataUrl } from "./flatMarkup";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось отрисовать SVG"));
    img.src = src;
  });
}

/** SVG → PNG (scale — множитель разрешения) и скачать. */
export async function exportSvgAsPng(
  svgMarkup: string,
  fileName: string,
  scale = 3,
): Promise<void> {
  const m = svgMarkup.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const w = m ? parseFloat(m[1]) : 600;
  const h = m ? parseFloat(m[2]) : 760;

  const img = await loadImage(svgToDataUrl(svgMarkup));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D недоступен");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
}
