// Загрузка макета пользователя (SVG/PNG) с физическим размером в мм.
// dpi в MVP заполняем, но не блокируем (BUILD.md решение #6/#7).
"use client";

import type { AssetType } from "@/types";

export interface LoadedAsset {
  type: AssetType;
  dataUrl: string;
  source_file: string;
  intrinsic_size_mm: { width: number; height: number };
  naturalWidth: number;
  naturalHeight: number;
  dpi?: number;
}

/** Дефолтная ширина печати для растровых макетов без метрики (мм). */
const DEFAULT_RASTER_WIDTH_MM = 120;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Размер SVG в мм из viewBox/width (предполагаем 1 unit = 1 мм). */
function parseSvgSizeMm(svgText: string): { w: number; h: number } | null {
  const vb = svgText.match(/viewBox\s*=\s*["']\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)/i);
  if (vb) {
    const w = parseFloat(vb[3]);
    const h = parseFloat(vb[4]);
    if (w > 0 && h > 0) return { w, h };
  }
  return null;
}

export async function loadAsset(file: File): Promise<LoadedAsset> {
  const dataUrl = await readAsDataUrl(file);
  const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

  if (isSvg) {
    const text = await file.text();
    const mm = parseSvgSizeMm(text);
    // Получаем natural-размер для соотношения сторон.
    const { naturalWidth, naturalHeight } = await imageNaturalSize(dataUrl);
    const width = mm?.w ?? DEFAULT_RASTER_WIDTH_MM;
    const aspect = naturalHeight / naturalWidth || (mm ? mm.h / mm.w : 1);
    const height = mm?.h ?? width * aspect;
    return {
      type: "svg",
      dataUrl,
      source_file: file.name,
      intrinsic_size_mm: { width, height },
      naturalWidth,
      naturalHeight,
    };
  }

  const { naturalWidth, naturalHeight } = await imageNaturalSize(dataUrl);
  const aspect = naturalHeight / naturalWidth || 1;
  const width = DEFAULT_RASTER_WIDTH_MM;
  const height = width * aspect;
  return {
    type: "png",
    dataUrl,
    source_file: file.name,
    intrinsic_size_mm: { width, height },
    naturalWidth,
    naturalHeight,
  };
}

function imageNaturalSize(
  src: string,
): Promise<{ naturalWidth: number; naturalHeight: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () =>
      resolve({
        naturalWidth: img.naturalWidth || 1,
        naturalHeight: img.naturalHeight || 1,
      });
    img.onerror = () => reject(new Error("Не удалось прочитать изображение"));
    img.src = src;
  });
}
