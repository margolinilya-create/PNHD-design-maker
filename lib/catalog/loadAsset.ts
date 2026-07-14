// Загрузка макета пользователя (SVG/PNG) с физическим размером в мм.
// dpi в MVP заполняем, но не блокируем (BUILD.md решение #6/#7).
"use client";

import type { AssetType } from "@/types";
import { isPdfLike, loadPdfAsset } from "./loadPdf";
import { parseViewBox, imageNaturalSize } from "./svgMeta";

export interface LoadedAsset {
  type: AssetType;
  dataUrl: string;
  source_file: string;
  intrinsic_size_mm: { width: number; height: number };
  naturalWidth: number;
  naturalHeight: number;
  dpi?: number;
  /** true — физический размер не выведен из файла, взят дефолт (оценка). */
  size_estimated: boolean;
}

/** Дефолтная ширина печати для растровых макетов без метрики (мм). */
const DEFAULT_RASTER_WIDTH_MM = 120;

/** Перевод единиц длины в мм. 1px=0.2645833мм, 1pt=0.352778мм, 1cm=10мм. */
const UNIT_TO_MM: Record<string, number> = {
  mm: 1,
  cm: 10,
  px: 0.2645833,
  pt: 0.352778,
};

/**
 * Парсит число с единицей (например "210mm", "595.3pt", "300") → мм.
 * `physical: true` — единица физическая (mm/cm/pt); px и unitless (=px)
 * пересчитываются через 96dpi, но это лишь конвенция CSS, а не метрика файла.
 */
function lengthToMm(
  raw: string | null,
): { mm: number; physical: boolean } | null {
  if (!raw) return null;
  const m = raw.trim().match(/^([\d.]+)\s*(mm|cm|px|pt)?$/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!(value > 0)) return null;
  const unit = (m[2] ?? "px").toLowerCase();
  const factor = UNIT_TO_MM[unit];
  if (factor === undefined) return null;
  return { mm: value * factor, physical: unit !== "px" };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Размер SVG в мм. Достоверный источник — width/height с физическими
 * единицами (mm/cm/pt). px/unitless пересчитываем через 96dpi, но помечаем
 * оценкой; viewBox-only трактуем как 1 unit = 1 мм — тоже ДОГАДКА (юниты
 * viewBox почти всегда произвольны). `estimated: true` включает предупреждение
 * preflight/инспектора «размер оценочно — уточните Ш×В».
 */
export function parseSvgSizeMm(
  svgText: string,
): { w: number; h: number; estimated: boolean } | null {
  const wAttr = svgText.match(/<svg[^>]*\bwidth\s*=\s*["']([^"']+)["']/i);
  const hAttr = svgText.match(/<svg[^>]*\bheight\s*=\s*["']([^"']+)["']/i);
  const w = lengthToMm(wAttr?.[1] ?? null);
  const h = lengthToMm(hAttr?.[1] ?? null);
  if (w !== null && h !== null) {
    return { w: w.mm, h: h.mm, estimated: !(w.physical && h.physical) };
  }

  const vb = parseViewBox(svgText);
  if (vb && vb.w > 0 && vb.h > 0) return { w: vb.w, h: vb.h, estimated: true };
  return null;
}

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Чтение pHYs-чанка PNG. Возвращает dpi, если разрешение задано в px/m
 * (unit=1), иначе null. Считаем пиксели квадратными (берём ppuX).
 */
function readPngDpi(buf: ArrayBuffer): number | null {
  const view = new DataView(buf);
  if (view.byteLength < 8) return null;
  // Сигнатура PNG: 8 байт.
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (view.getUint8(i) !== sig[i]) return null;
  }
  let offset = 8;
  while (offset + 8 <= view.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7),
    );
    const dataStart = offset + 8;
    if (type === "pHYs") {
      if (dataStart + 9 > view.byteLength) return null;
      const ppuX = view.getUint32(dataStart);
      const unit = view.getUint8(dataStart + 8);
      // unit=1 — пиксели на метр. px/m → dpi: ppm * 0.0254.
      if (unit === 1 && ppuX > 0) return ppuX * 0.0254;
      return null;
    }
    if (type === "IEND") break;
    // length + type(4) + data + crc(4).
    offset = dataStart + length + 4;
  }
  return null;
}

export async function loadAsset(file: File): Promise<LoadedAsset> {
  // PDF/AI — отдельный лоадер (сам pdfjs подтягивается динамически внутри).
  if (isPdfLike(file)) return loadPdfAsset(file);

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
      // Достоверно только из width/height с единицами; viewBox-only — оценка.
      size_estimated: mm === null || mm.estimated,
    };
  }

  const { naturalWidth, naturalHeight } = await imageNaturalSize(dataUrl);

  // Пробуем извлечь dpi из pHYs-чанка PNG.
  let dpi: number | undefined;
  try {
    const buf = await readAsArrayBuffer(file);
    dpi = readPngDpi(buf) ?? undefined;
  } catch {
    dpi = undefined;
  }

  const aspect = naturalHeight / naturalWidth || 1;
  let width: number;
  let height: number;
  let size_estimated: boolean;

  if (dpi && dpi > 0) {
    // Физический размер из реального dpi: px / dpi * 25.4.
    width = (naturalWidth / dpi) * 25.4;
    height = (naturalHeight / dpi) * 25.4;
    size_estimated = false;
  } else {
    // Метрики нет — дефолтная ширина (оценка).
    width = DEFAULT_RASTER_WIDTH_MM;
    height = width * aspect;
    size_estimated = true;
  }

  return {
    type: "png",
    dataUrl,
    source_file: file.name,
    intrinsic_size_mm: { width, height },
    naturalWidth,
    naturalHeight,
    dpi,
    size_estimated,
  };
}
