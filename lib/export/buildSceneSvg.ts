// Композиция минимального тех-листа в ЕДИНЫЙ SVG (скил vector-pdf-export),
// светлая ДС «Студия»: шапка заказа (клиент/№/дата/статус), рисунок 1:1 в мм
// (флэт + нанесения + отступ от горловины + плашка Ш×В), крупная метка размера
// и шкала контроля 1:1. Варианты full/production удалены по аудиту 2026-07 —
// в проде живёт только минимальный лист (решение менеджера, PR #44/#58).
import type { Asset, Placement, SKU, View } from "@/types";
import { viewZone } from "@/lib/geometry/view";
import { buildDimensionLines } from "@/lib/geometry/dimensionLines";
import { recolorGarment } from "@/lib/export/flatMarkup";
import { resolveMethod, printMethodProfile } from "@/lib/catalog/printMethod";

/**
 * Имя семейства для текстов листа. Регистрируется в jsPDF из
 * public/fonts/LiberationSans-*.ttf (exportPdf.ts) — стандартные шрифты jsPDF
 * не несут кириллицу. В браузерном превью падает на Helvetica/sans-serif.
 */
export const PDF_FONT_FAMILY = "LiberationSans";

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
  flatSvgMarkup: string; // исходный <svg>…</svg> флэта («» при растровом флэте)
  /**
   * Растровый флэт (data URL PNG/JPEG — напр. загруженная PDF/AI-визуалка):
   * рисуется <image> на всю площадь flatMm вместо inner-SVG.
   * Перекраска garmentColor к растру не применяется.
   */
  flatRaster?: { dataUrl: string };
  flatMm: { w: number; h: number }; // габариты флэта В МИЛЛИМЕТРАХ
  /** Коэффициент единицы SVG флэта → мм (1 = 1 ед = 1 мм). */
  scaleMmPerUnit?: number;
  /** Цвет ткани (перекраска силуэта). */
  garmentColor?: string;
  placements: Placement[];
  assets: Record<string, Asset>;
  meta: {
    client: string;
    orderRef: string;
    size: string;
    date: string;
    status?: "draft" | "approved";
  };
}

// ── Палитра «Студия» ──
const C = {
  ink: "#111827",
  heading: "#111827",
  body: "#4b5563",
  label: "#6b7280",
  hint: "#9ca3af",
  line: "#e4e7ec",
  lineSubtle: "#eef0f3",
  zone: "#2563eb",
  anchor: "#e11d48",
  emerald600: "#059669",
  halo: "rgba(255,255,255,0.85)",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function innerSvg(markup: string): string {
  const m = markup.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return m ? m[1] : "";
}

/** Калибровочная шкала 100 мм (контроль 1:1 линейкой). Подписи latin-safe. */
function calibrationBar(x: number, y: number): string {
  const LEN = 100;
  let ticks = "";
  for (let i = 0; i <= 10; i++) {
    const tx = x + i * 10;
    const h = i % 5 === 0 ? 5 : 3;
    ticks += `<line x1="${tx}" y1="${y}" x2="${tx}" y2="${y - h}" stroke="${C.body}" stroke-width="0.5"/>`;
  }
  return `<g data-calibration-mm="${LEN}">
    <text x="${x}" y="${y - 8}" font-size="8" fill="${C.hint}">scale 1:1</text>
    <line x1="${x}" y1="${y}" x2="${x + LEN}" y2="${y}" stroke="${C.body}" stroke-width="0.75"/>
    ${ticks}
    <text x="${x}" y="${y + 9}" font-size="9" fill="${C.body}">0</text>
    <text x="${x + LEN}" y="${y + 9}" font-size="9" fill="${C.body}" text-anchor="end">100 mm</text>
  </g>`;
}

type DimScene = ReturnType<typeof buildDimensionLines>;

/** Красная линия отступа от шва горловины с числом и точкой якоря. */
function neckOffsetMarkup(scene: DimScene, toleranceMm?: number): string {
  const vAnchor = scene.lines.find((l) => l.kind === "vertical-anchor")!;
  const { aabb, centerX, anchorY } = scene;
  const tol = toleranceMm && toleranceMm > 0 ? ` ±${toleranceMm}` : "";
  const nl = `${Math.round(vAnchor.value)}${tol}`;
  const nlW = nl.length * 3.5 + 6;
  // Число — на измеряемом участке «шов горловины → верх макета»
  // (не в центре макета: там его перекрывала плашка Ш×В).
  const nlY = anchorY + Math.max(9, (aabb.y - anchorY) / 2);
  return `<line x1="${vAnchor.from.x}" y1="${vAnchor.from.y}" x2="${vAnchor.to.x}" y2="${vAnchor.to.y}" stroke="${C.anchor}" stroke-width="1" stroke-dasharray="5 4"/>
        <rect x="${centerX - 5 - nlW}" y="${nlY - 9}" width="${nlW}" height="12" rx="2" fill="${C.halo}"/>
        <text x="${centerX - 8}" y="${nlY}" font-size="11" fill="${C.anchor}" text-anchor="end" style="font-variant-numeric:tabular-nums">${nl}</text>
        <circle cx="${centerX}" cy="${anchorY}" r="3" fill="${C.anchor}"/>`;
}

/** Синяя плашка «Ш×В mm» у верха нанесения (размер макета). */
function whPlateMarkup(scene: DimScene): string {
  const { aabb } = scene;
  const midX = aabb.x + aabb.w / 2;
  const wh = `${Math.round(aabb.w)}×${Math.round(aabb.h)} mm`;
  const whHalfW = wh.length * 3.6 + 3;
  const whY = aabb.y + 3;
  return `<rect x="${midX - whHalfW}" y="${whY}" width="${whHalfW * 2}" height="16" rx="2" fill="${C.zone}"/>
        <text x="${midX}" y="${whY + 11}" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle" style="font-variant-numeric:tabular-nums">${esc(wh)}</text>`;
}

/**
 * Шапка заказа: вордмарк слева, справа — клиент/№ заказа/дата и статус-чип.
 * Идентифицирует документ, уходящий в цех/клиенту (аудит 2026-07: раньше
 * минимальный лист печатался вообще без атрибуции заказа).
 */
function orderHeader(W: number, meta: SceneInput["meta"]): string {
  const rx = W - 14;
  const metaLine = `Клиент: ${meta.client.trim() || "—"} · Заказ №: ${
    meta.orderRef.trim() || "—"
  } · ${meta.date}`;
  const approved = meta.status === "approved";
  const chipW = 34;
  const chip = `<rect x="${rx - chipW}" y="12.5" width="${chipW}" height="7" rx="2" fill="${approved ? C.emerald600 : C.lineSubtle}"/>
    <text x="${rx - chipW / 2}" y="17.5" font-size="5.5" fill="${approved ? "#fff" : C.label}" text-anchor="middle">${approved ? "Согласовано" : "Черновик"}</text>`;
  return `<g data-order-header="1">
    <text x="14" y="12" font-size="10" font-weight="800" fill="${C.heading}" letter-spacing="-0.3">PINHEAD</text>
    <text x="14" y="18.5" font-size="5.5" fill="${C.label}">Тех-рисунок · масштаб 1:1 · мм</text>
    <text x="${rx}" y="9.5" font-size="6.5" fill="${C.heading}" text-anchor="end" style="font-variant-numeric:tabular-nums">${esc(metaLine)}</text>
    ${chip}
    <line x1="14" y1="22" x2="${rx}" y2="22" stroke="${C.line}" stroke-width="0.6"/>
  </g>`;
}

/** Собрать SVG минимального тех-листа. Рисунок 1:1 в мм; страница в мм. */
export function buildSceneSvg(input: SceneInput): string {
  const { view, flatMm, placements, assets, meta } = input;

  // Раскладка (мм)
  const PAD = 14;
  const HEADER_H = 26; // шапка заказа + линия + воздух
  const SIZE_H = 42; // блок под изделием — буква размера + шкала 1:1
  const drawW = flatMm.w;
  const drawH = flatMm.h;
  const W = PAD + drawW + PAD;
  const H = HEADER_H + drawH + SIZE_H + PAD;
  const DX = PAD;
  const DY = HEADER_H;

  // Клипы нанесений по их зонам (координаты — в пространстве рисунка).
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
      const hrefVal = escAttr(asset.data_url);
      const profile = placementMethod(view, p);
      return `<g data-layer="production" data-method="${profile.id}" data-color-mode="${profile.colorMode}" clip-path="url(#clip-${i})"><g transform="rotate(${p.rotation_deg} ${cx} ${cy}) translate(${cx} ${cy}) scale(${sx} ${sy}) translate(${-cx} ${-cy})">
        <image href="${hrefVal}" xlink:href="${hrefVal}" x="${p.x_mm}" y="${p.y_mm}" width="${p.width_mm}" height="${p.height_mm}" preserveAspectRatio="none"/>
      </g></g>`;
    })
    .join("\n");

  // На нанесение — только отступ от горловины и плашка Ш×В.
  const minDims = placements
    .map((p) => {
      const scene = buildDimensionLines(
        view,
        { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
        p.rotation_deg,
        meta.size,
        p.print_area_id,
      );
      return `${neckOffsetMarkup(scene, p.tolerance_mm)}
        ${whPlateMarkup(scene)}`;
    })
    .join("\n");

  const garmentLayer = input.flatRaster
    ? `<image href="${escAttr(input.flatRaster.dataUrl)}" xlink:href="${escAttr(input.flatRaster.dataUrl)}" x="0" y="0" width="${drawW}" height="${drawH}" preserveAspectRatio="none"/>`
    : `<g transform="scale(${input.scaleMmPerUnit ?? 1})">${innerSvg(recolorGarment(input.flatSvgMarkup, input.garmentColor ?? ""))}</g>`;

  const drawing = `<g transform="translate(${DX} ${DY})">
    <g data-layer="garment">${garmentLayer}</g>
    <g data-layer="production-artwork">${placementSvg}</g>
    <g data-layer="markup">
      ${minDims}
    </g>
  </g>`;

  // Под изделием — крупная метка размера (как на лекалах) + шкала.
  // Кегль адаптивный: буква (M/L) — 34, длинная метка (ONE SIZE) — 20.
  const sizeY = DY + drawH + 30;
  const sizeFs = meta.size.length <= 3 ? 34 : 20;
  const sizeBlock = `<g data-size-label="${escAttr(meta.size)}">
    <text x="${W / 2}" y="${sizeY + 4}" font-size="${sizeFs}" font-weight="800" fill="${C.ink}" text-anchor="middle">${esc(meta.size)}</text>
  </g>
  ${calibrationBar(W - PAD - 100, sizeY - 4)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" font-family="${PDF_FONT_FAMILY}, Helvetica, sans-serif">
  <defs>
    ${clipDefs}
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
  ${orderHeader(W, meta)}
  ${drawing}
  ${sizeBlock}
</svg>`;
}
