// Загрузка PDF/AI-макета: рендер 1-й страницы в PNG data URL + физический
// размер в мм из MediaBox (1 pt = 25.4/72 мм — точный, без оценки).
// AI поддерживается только PDF-совместимый (галочка «Create PDF Compatible
// File» в Illustrator) — такие файлы начинаются с %PDF.
// Модуль импортируется ДИНАМИЧЕСКИ из loadAsset — pdfjs не попадает в общий
// бандл редактора и в vitest.
"use client";

import type { LoadedAsset } from "./loadAsset";

const PT_TO_MM = 25.4 / 72;
/** Целевая плотность растеризации от физического размера. */
const TARGET_DPI = 300;
/** Кап по длинной стороне растра (px) — защита от гигантских артбордов. */
const MAX_PX = 4096;

export function isPdfLike(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    file.type === "application/pdf" || n.endsWith(".pdf") || n.endsWith(".ai")
  );
}

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Воркер отдаётся статикой из /public (webpack не парсит минифицированный
  // .mjs; копия обновляется вместе с зависимостью — см. scripts в README).
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

/** PDF/AI → LoadedAsset (растр PNG + мм из MediaBox). */
export async function loadPdfAsset(file: File): Promise<LoadedAsset> {
  const buf = await file.arrayBuffer();
  const head = new TextDecoder("ascii").decode(buf.slice(0, 1024));
  if (!head.includes("%PDF")) {
    throw new Error(
      "AI без PDF-совместимости — пересохраните в Illustrator с галочкой «Create PDF Compatible File»",
    );
  }

  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 }); // pt
    const wMm = base.width * PT_TO_MM;
    const hMm = base.height * PT_TO_MM;

    // Масштаб растра: ~300 dpi от физического размера, но не больше капа.
    const targetPx = (Math.max(wMm, hMm) / 25.4) * TARGET_DPI;
    const scale = Math.min(targetPx, MAX_PX) / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D недоступен");
    // Белая подложка: PDF часто с прозрачным фоном, дальше пайплайн ждёт PNG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const dpi = (canvas.width / wMm) * 25.4;
    return {
      type: "png",
      dataUrl: canvas.toDataURL("image/png"),
      source_file: file.name,
      intrinsic_size_mm: { width: wMm, height: hMm },
      naturalWidth: canvas.width,
      naturalHeight: canvas.height,
      dpi,
      // Размер точный — из MediaBox.
      size_estimated: false,
    };
  } finally {
    void doc.destroy();
  }
}
