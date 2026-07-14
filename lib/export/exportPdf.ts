// SVG сцен → единый векторный PDF (jsPDF + svg2pdf.js), масштаб 1:1 в мм.
// Один PDF на проект: каждая сцена (вид) — отдельная страница.
// Кириллица: стандартные шрифты jsPDF её не несут, поэтому перед сборкой
// лениво подгружаем LiberationSans из public/fonts и регистрируем в VFS —
// svg2pdf подхватывает его по font-family листа (PDF_FONT_FAMILY).
"use client";

import { jsPDF } from "jspdf";
import "svg2pdf.js";
import { PDF_FONT_FAMILY } from "./buildSceneSvg";

function parseSvg(markup: string): SVGSVGElement {
  const container = document.createElement("div");
  container.innerHTML = markup;
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("Не удалось разобрать SVG сцены");
  return svg as SVGSVGElement;
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  // Чанками — String.fromCharCode(...400КБ) переполнил бы стек аргументов.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

// Кэш на сессию: шрифты тянем с сервера один раз, не на каждый экспорт.
let fontCache: { normal: string; bold: string } | null = null;

async function loadCyrillicFonts(): Promise<typeof fontCache> {
  if (fontCache) return fontCache;
  const fetchB64 = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`шрифт ${url}: ${res.status}`);
    return bufToBase64(await res.arrayBuffer());
  };
  const [normal, bold] = await Promise.all([
    fetchB64("/fonts/LiberationSans-Regular.ttf"),
    fetchB64("/fonts/LiberationSans-Bold.ttf"),
  ]);
  fontCache = { normal, bold };
  return fontCache;
}

/** Зарегистрировать кириллический шрифт в документе (best-effort). */
async function registerFonts(pdf: jsPDF): Promise<void> {
  try {
    const fonts = await loadCyrillicFonts();
    if (!fonts) return;
    pdf.addFileToVFS("LiberationSans-Regular.ttf", fonts.normal);
    pdf.addFont("LiberationSans-Regular.ttf", PDF_FONT_FAMILY, "normal");
    pdf.addFileToVFS("LiberationSans-Bold.ttf", fonts.bold);
    pdf.addFont("LiberationSans-Bold.ttf", PDF_FONT_FAMILY, "bold");
    pdf.setFont(PDF_FONT_FAMILY);
  } catch {
    // Шрифт не доехал — собираем на стандартных (кириллица деградирует,
    // геометрия листа не страдает). Не блокируем экспорт.
  }
}

/** Собрать многостраничный PDF из массива SVG-сцен и скачать. */
export async function exportScenesPdf(
  svgMarkups: string[],
  fileName: string,
): Promise<void> {
  if (svgMarkups.length === 0) throw new Error("Нет сцен для экспорта");

  let pdf: jsPDF | null = null;
  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  document.body.appendChild(holder);

  try {
    for (let i = 0; i < svgMarkups.length; i++) {
      const svg = parseSvg(svgMarkups[i]);
      holder.appendChild(svg);
      const wMm = parseFloat(svg.getAttribute("width") || "210");
      const hMm = parseFloat(svg.getAttribute("height") || "297");
      const orientation = wMm > hMm ? "landscape" : "portrait";

      if (!pdf) {
        pdf = new jsPDF({ orientation, unit: "mm", format: [wMm, hMm] });
        await registerFonts(pdf);
      } else {
        pdf.addPage([wMm, hMm], orientation);
      }
      await pdf.svg(svg, { x: 0, y: 0, width: wMm, height: hMm });
      holder.removeChild(svg);
    }
    pdf!.save(fileName);
  } finally {
    document.body.removeChild(holder);
  }
}
