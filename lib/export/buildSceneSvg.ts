// Композиция итоговой сцены в ЕДИНЫЙ SVG (скил vector-pdf-export).
// Флэт + макеты + размерная обвязка + подписи + рамка проекта. Масштаб 1:1 в мм.
import type { Asset, Placement, SKU, View } from "@/types";
import { viewZone } from "@/lib/geometry/view";
import { buildDimensionLines } from "@/lib/geometry/dimensionLines";
import { recolorGarment } from "@/lib/export/flatMarkup";
import { resolveMethod, printMethodProfile } from "@/lib/catalog/printMethod";

/** Эффективный метод нанесения с учётом дефолта зоны. */
function placementMethod(view: View, p: Placement) {
  const areaDefault = view.print_areas.find(
    (a) => a.id === p.print_area_id,
  )?.default_method;
  return printMethodProfile(resolveMethod(p.method, areaDefault));
}

export interface SceneInput {
  sku: SKU;
  view: View;
  flatSvgMarkup: string; // исходный <svg>…</svg> флэта
  flatMm: { w: number; h: number }; // габариты флэта В МИЛЛИМЕТРАХ
  /** Коэффициент единицы SVG флэта → мм (1 = 1 ед = 1 мм). */
  scaleMmPerUnit?: number;
  /** Цвет ткани (перекраска силуэта). */
  garmentColor?: string;
  placements: Placement[];
  assets: Record<string, Asset>;
  meta: { client: string; orderRef: string; size: string; date: string };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Экранирование значений, попадающих в атрибуты (href/xlink:href и т.п.):
// дополнительно к & < > экранируем кавычки.
const escAttr = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Вынуть внутренности <svg> флэта, чтобы вложить как <g>. */
function innerSvg(markup: string): string {
  const m = markup.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return m ? m[1] : "";
}

function dimArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  text: string,
  danger = false,
): string {
  const c = danger ? "#d12f33" : "#444";
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Белая полупрозрачная подложка (halo) под числом, чтобы не терялось на флэте/макете.
  const halfW = text.length * 3.5 + 2;
  return `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>
    <rect x="${mx - halfW}" y="${my - 13}" width="${halfW * 2}" height="13" fill="#ffffff" fill-opacity="0.75"/>
    <text x="${mx}" y="${my - 3}" font-size="11" fill="${c}" text-anchor="middle">${esc(text)}</text>`;
}

/**
 * Калибровочная шкала 100 мм с тиками (каждые 10 мм) — печатается на тех-листе.
 * Приложив линейку, оператор подтверждает масштаб 1:1. Тег data-calibration-mm
 * — для автотеста.
 */
function calibrationBar(x: number, y: number): string {
  const LEN = 100; // мм
  let ticks = "";
  for (let i = 0; i <= 10; i++) {
    const tx = x + i * 10;
    const h = i % 5 === 0 ? 5 : 3;
    ticks += `<line x1="${tx}" y1="${y}" x2="${tx}" y2="${y - h}" stroke="#111" stroke-width="0.5"/>`;
  }
  return `<g data-calibration-mm="${LEN}">
    <text x="${x}" y="${y - 8}" font-size="8" fill="#666">контроль масштаба 1:1</text>
    <line x1="${x}" y1="${y}" x2="${x + LEN}" y2="${y}" stroke="#111" stroke-width="0.75"/>
    ${ticks}
    <text x="${x}" y="${y + 9}" font-size="9" fill="#111">0</text>
    <text x="${x + LEN}" y="${y + 9}" font-size="9" fill="#111" text-anchor="end">100 мм</text>
  </g>`;
}

/** Собрать SVG сцены. Размеры страницы — в мм (1 unit = 1 мм). */
export function buildSceneSvg(input: SceneInput): string {
  const { view, flatMm, placements, assets, sku, meta } = input;
  const FRAME_H = 60; // рамка проекта снизу, мм
  const W = Math.max(flatMm.w, 240);
  const H = flatMm.h + FRAME_H;

  // Маскирование макета по его печатной зоне (как на холсте).
  const clipDefs = placements
    .map((p, i) => {
      const { zone } = viewZone(view, meta.size, p.print_area_id);
      return `<clipPath id="clip-${i}"><rect x="${zone.zx}" y="${zone.zy}" width="${zone.zw}" height="${zone.zh}"/></clipPath>`;
    })
    .join("\n    ");

  const placementSvg = placements
    .map((p, i) => {
      const asset = assets[p.asset_id];
      if (!asset?.data_url) return "";
      const cx = p.x_mm + p.width_mm / 2;
      const cy = p.y_mm + p.height_mm / 2;
      const sx = p.flip_h ? -1 : 1;
      const sy = p.flip_v ? -1 : 1;
      // href + xlink:href (то же значение) для надёжной вставки в разных рендерах; значение экранируем.
      const hrefVal = escAttr(asset.data_url);
      const profile = placementMethod(view, p);
      // Production-слой: чистое нанесение, помечено методом/режимом цвета для цеха/RIP.
      return `<g data-layer="production" data-method="${profile.id}" data-color-mode="${profile.colorMode}" clip-path="url(#clip-${i})"><g transform="rotate(${p.rotation_deg} ${cx} ${cy}) translate(${cx} ${cy}) scale(${sx} ${sy}) translate(${-cx} ${-cy})">
        <image href="${hrefVal}" xlink:href="${hrefVal}" x="${p.x_mm}" y="${p.y_mm}" width="${p.width_mm}" height="${p.height_mm}" preserveAspectRatio="none"/>
      </g></g>`;
    })
    .join("\n");

  const dimsSvg = placements
    .map((p) => {
      // S2.1: обвязка как структурный объект — единый источник линий и чисел.
      const scene = buildDimensionLines(
        view,
        { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
        p.rotation_deg,
        input.meta.size,
        p.print_area_id,
      );
      const { aabb, zone, centerX, anchorY, lines } = scene;
      const midX = aabb.x + aabb.w / 2;
      const midY = aabb.y + aabb.h / 2;
      const line = (k: (typeof lines)[number]["kind"]) =>
        lines.find((l) => l.kind === k)!;
      // Размерные стрелки до краёв зоны (left/right/top/bottom).
      const edges = (["left", "right", "top", "bottom"] as const)
        .map((k) => {
          const l = line(k);
          return dimArrow(
            l.from.x,
            l.from.y,
            l.to.x,
            l.to.y,
            `${Math.round(l.value)}`,
            l.danger,
          );
        })
        .join("\n        ");
      const vAnchor = line("vertical-anchor");
      const hAnchor = line("horizontal-anchor");
      // Метка Ш×В с halo-подложкой для читаемости.
      const wh = `${Math.round(aabb.w)}×${Math.round(aabb.h)} мм`;
      const whHalfW = wh.length * 3.5 + 2;
      // Подпись метода печати под Ш×В (режим цвета — для цеха).
      const profile = placementMethod(view, p);
      const methodText = `${profile.label} · ${profile.colorMode === "spot" ? "spot/Pantone" : "CMYK"}`;
      const mtHalfW = methodText.length * 2.8 + 2;
      // Допуск ± на ключевую меру (отступ от горловины) и HTM-заметка (P1 #13).
      const tol =
        p.tolerance_mm && p.tolerance_mm > 0 ? ` ±${p.tolerance_mm}` : "";
      const htm = p.htm?.trim();
      const htmHalfW = htm ? htm.length * 2.6 + 2 : 0;
      const htmSvg = htm
        ? `<rect x="${midX - htmHalfW}" y="${midY + 14}" width="${htmHalfW * 2}" height="11" fill="#ffffff" fill-opacity="0.75"/>
        <text x="${midX}" y="${midY + 22}" font-size="8" fill="#777" text-anchor="middle">${esc(`HTM: ${htm}`)}</text>`
        : "";
      return `
        ${edges}
        <line x1="${vAnchor.from.x}" y1="${vAnchor.from.y}" x2="${vAnchor.to.x}" y2="${vAnchor.to.y}" stroke="#d12f33" stroke-width="1" stroke-dasharray="5 4"/>
        <text x="${centerX + 4}" y="${(anchorY + midY) / 2}" font-size="11" fill="#d12f33">↕${Math.round(vAnchor.value)}${tol}</text>
        <line x1="${centerX}" y1="${zone.zy}" x2="${centerX}" y2="${zone.zy + zone.zh}" stroke="#d12f33" stroke-width="0.75" stroke-dasharray="3 3"/>
        ${dimArrow(hAnchor.from.x, hAnchor.from.y, hAnchor.to.x, hAnchor.to.y, `${Math.round(hAnchor.value)}`, false)}
        <rect x="${midX - whHalfW}" y="${midY - 11}" width="${whHalfW * 2}" height="14" fill="#ffffff" fill-opacity="0.75"/>
        <text x="${midX}" y="${midY}" font-size="12" font-weight="bold" fill="#111" text-anchor="middle">${esc(wh)}</text>
        <rect x="${midX - mtHalfW}" y="${midY + 3}" width="${mtHalfW * 2}" height="11" fill="#ffffff" fill-opacity="0.75"/>
        <text x="${midX}" y="${midY + 11}" font-size="8" fill="#555" text-anchor="middle">${esc(methodText)}</text>
        ${htmSvg}`;
    })
    .join("\n");

  // Сводка методов печати по нанесениям вида (для рамки проекта).
  const methodsSummary = (() => {
    const seen = new Map<string, string>();
    for (const p of placements) {
      const pr = placementMethod(view, p);
      seen.set(
        pr.id,
        `${pr.label} (${pr.colorMode === "spot" ? "spot/Pantone" : "CMYK"})`,
      );
    }
    return [...seen.values()].join(", ");
  })();

  const frameY = flatMm.h + 8;
  const frame = `
    <line x1="0" y1="${flatMm.h}" x2="${W}" y2="${flatMm.h}" stroke="#ccc" stroke-width="0.5"/>
    <text x="4" y="${frameY + 10}" font-size="12" font-weight="bold" fill="#111">${esc(sku.name)} · размер ${esc(meta.size)}</text>
    <text x="4" y="${frameY + 26}" font-size="11" fill="#333">Клиент: ${esc(meta.client || "—")}   Заказ: ${esc(meta.orderRef || "—")}</text>
    <text x="4" y="${frameY + 42}" font-size="11" fill="#333">Вид: ${esc(view.kind)}   Дата: ${esc(meta.date)}   Масштаб 1:1 (мм)</text>
    ${methodsSummary ? `<text x="4" y="${frameY + 56}" font-size="10" fill="#555">Метод печати: ${esc(methodsSummary)}</text>` : ""}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
      <path d="M0,4 L8,1 L8,7 Z" fill="#444"/>
    </marker>
    ${clipDefs}
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
  <g data-layer="garment" transform="scale(${input.scaleMmPerUnit ?? 1})">${innerSvg(recolorGarment(input.flatSvgMarkup, input.garmentColor ?? ""))}</g>
  <g data-layer="production-artwork">${placementSvg}</g>
  <g data-layer="markup">
  ${dimsSvg}
  ${frame}
  ${calibrationBar(W - 110, flatMm.h + 50)}
  </g>
</svg>`;
}
