// SVG сцен → единый векторный PDF (jsPDF + svg2pdf.js), масштаб 1:1 в мм.
// Один PDF на проект: каждая сцена (вид) — отдельная страница.
"use client";

import { jsPDF } from "jspdf";
import "svg2pdf.js";

function parseSvg(markup: string): SVGSVGElement {
  const container = document.createElement("div");
  container.innerHTML = markup;
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("Не удалось разобрать SVG сцены");
  return svg as SVGSVGElement;
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
