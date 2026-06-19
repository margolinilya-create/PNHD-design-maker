// Композиция итогового тех-листа в ЕДИНЫЙ SVG (скил vector-pdf-export),
// светлая ДС «Студия»: титульный блок, рисунок 1:1 в мм (флэт + зоны + обвязка),
// панель спецификации, легенда линий, footer. Рисунок остаётся 1:1 (линейкой).
import type { Asset, Placement, SKU, View } from "@/types";
import { viewZone } from "@/lib/geometry/view";
import { buildDimensionLines } from "@/lib/geometry/dimensionLines";
import { recolorGarment } from "@/lib/export/flatMarkup";
import { resolveMethod, printMethodProfile } from "@/lib/catalog/printMethod";
import { printQuality } from "@/lib/catalog/dpi";

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
  meta: {
    client: string;
    orderRef: string;
    size: string;
    date: string;
    status?: "draft" | "approved";
  };
  /**
   * Вариант листа (P2 #4):
   * - "full" (по умолчанию) — флэт + нанесения + обвязка + спецификация;
   * - "production" — флэт + чистое нанесение без обвязки (для цеха).
   */
  variant?: "full" | "production";
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
  sunken: "#f9fafb",
  zone: "#2563eb",
  zoneFill: "rgba(37,140,235,0.05)",
  safe: "#16a34a",
  dim: "#94a3b8",
  dimText: "#475569",
  anchor: "#e11d48",
  blue50: "#eff4ff",
  blue100: "#dbeafe",
  blue700: "#1d4ed8",
  emerald600: "#059669",
  emerald700: "#047857",
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

/** Размерная стрелка с числом на белом halo. */
function dimArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  text: string,
  danger = false,
): string {
  const c = danger ? C.anchor : C.dim;
  const tc = danger ? C.anchor : C.dimText;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const halfW = text.length * 3.5 + 3;
  return `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>
    <rect x="${mx - halfW}" y="${my - 13}" width="${halfW * 2}" height="13" rx="2" fill="${C.halo}"/>
    <text x="${mx}" y="${my - 3}" font-size="11" fill="${tc}" text-anchor="middle" style="font-variant-numeric:tabular-nums">${esc(text)}</text>`;
}

/** Калибровочная шкала 100 мм (контроль 1:1 линейкой). */
function calibrationBar(x: number, y: number): string {
  const LEN = 100;
  let ticks = "";
  for (let i = 0; i <= 10; i++) {
    const tx = x + i * 10;
    const h = i % 5 === 0 ? 5 : 3;
    ticks += `<line x1="${tx}" y1="${y}" x2="${tx}" y2="${y - h}" stroke="${C.body}" stroke-width="0.5"/>`;
  }
  return `<g data-calibration-mm="${LEN}">
    <text x="${x}" y="${y - 8}" font-size="8" fill="${C.hint}">контроль масштаба 1:1</text>
    <line x1="${x}" y1="${y}" x2="${x + LEN}" y2="${y}" stroke="${C.body}" stroke-width="0.75"/>
    ${ticks}
    <text x="${x}" y="${y + 9}" font-size="9" fill="${C.body}">0</text>
    <text x="${x + LEN}" y="${y + 9}" font-size="9" fill="${C.body}" text-anchor="end">100 мм</text>
  </g>`;
}

/** Титульный блок: вордмарк + сетка метаданных. */
function titleBlock(W: number, sku: SKU, view: View, meta: SceneInput["meta"]): string {
  const rx = W - 14;
  let rows = "";
  const kv: [string, string][] = [
    ["SKU", `${sku.name} · ${sku.type}`],
    ["Размер (эталон)", `${meta.size} · вид «${esc(view.kind)}»`],
    ["Клиент", meta.client || "—"],
    ["Заказ №", meta.orderRef || "—"],
    ["Дата", meta.date],
  ];
  kv.forEach(([k, v], i) => {
    const y = 16 + i * 6.2;
    rows += `<text x="${rx - 120}" y="${y}" font-size="6" fill="${C.hint}">${esc(k)}</text>
      <text x="${rx}" y="${y}" font-size="6" fill="${C.heading}" text-anchor="end" style="font-variant-numeric:tabular-nums">${esc(v)}</text>`;
  });
  const statusY = 16 + kv.length * 6.2;
  const approved = meta.status === "approved";
  const statusChip = `<text x="${rx - 120}" y="${statusY}" font-size="6" fill="${C.hint}">Статус</text>
    <rect x="${rx - 40}" y="${statusY - 5}" width="40" height="7" rx="2" fill="${approved ? C.emerald600 : C.lineSubtle}"/>
    <text x="${rx - 20}" y="${statusY}" font-size="5.5" fill="${approved ? "#fff" : C.label}" text-anchor="middle">${approved ? "Согласовано" : "Черновик"}</text>`;
  return `<g data-title="1">
    <text x="14" y="17" font-size="15" font-weight="800" fill="${C.heading}" letter-spacing="-0.3">PINHEAD</text>
    <text x="14" y="26" font-size="6.5" fill="${C.label}">Технический лист раскладки</text>
    ${rows}
    ${statusChip}
  </g>`;
}

/** Панель спецификации справа: по нанесению + легенда линий + инфо. */
function specPanel(
  x: number,
  y: number,
  w: number,
  view: View,
  placements: Placement[],
  assets: Record<string, Asset>,
  size: string,
): string {
  let cy = y + 4;
  const blocks: string[] = [];
  for (const p of placements) {
    const scene = buildDimensionLines(
      view,
      { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
      p.rotation_deg,
      size,
      p.print_area_id,
    );
    const get = (k: string) => scene.lines.find((l) => l.kind === k)!;
    const profile = placementMethod(view, p);
    const areaName =
      view.print_areas.find((a) => a.id === p.print_area_id)?.name ?? "зона";
    const q = printQuality(assets[p.asset_id], p.width_mm, p.method);
    const quality =
      q.quality === "vector"
        ? "вектор"
        : q.quality === "embroidery"
          ? "вышивка"
          : q.dpi
            ? `${Math.round(q.dpi)} dpi`
            : "—";
    const pantone =
      profile.colorMode === "spot" && p.pantone?.length
        ? ` · ${p.pantone.join(", ")}`
        : "";
    const colorMode = profile.colorMode === "spot" ? "spot/Pantone" : "CMYK";
    const rows: [string, string][] = [
      ["Метод печати", `${profile.label} · ${colorMode}${pantone}`],
      [
        "Размер печати",
        `${Math.round(scene.printWidth)} × ${Math.round(scene.printHeight)} мм${
          p.tolerance_mm ? ` ±${p.tolerance_mm}` : ""
        }`,
      ],
      ["Отступ от горловины", `${Math.round(get("vertical-anchor").value)} мм`],
      ["От оси (центр)", `${Math.round(get("horizontal-anchor").value)} мм`],
      [
        "Отступы зоны (Л/П/В/Н)",
        `${Math.round(get("left").value)} / ${Math.round(
          get("right").value,
        )} / ${Math.round(get("top").value)} / ${Math.round(get("bottom").value)}`,
      ],
      ["Качество", quality],
    ];
    if (p.htm?.trim()) rows.push(["Как мерить (HTM)", p.htm.trim()]);

    let table = `<text x="${x}" y="${cy}" font-size="6" font-weight="700" fill="${C.hint}" letter-spacing="0.3">НАНЕСЕНИЕ — ${esc(areaName.toUpperCase())}</text>`;
    cy += 7;
    for (const [k, v] of rows) {
      table += `<text x="${x}" y="${cy}" font-size="6.5" fill="${C.label}">${esc(k)}</text>
        <text x="${x + w}" y="${cy}" font-size="6.5" fill="${C.heading}" text-anchor="end" style="font-variant-numeric:tabular-nums">${esc(v)}</text>
        <line x1="${x}" y1="${cy + 2.5}" x2="${x + w}" y2="${cy + 2.5}" stroke="${C.lineSubtle}" stroke-width="0.4"/>`;
      cy += 8;
    }
    blocks.push(table);
    cy += 4;
  }

  // Легенда линий
  cy += 2;
  const legendRows = [
    [C.zone, "dash", "Печатная зона"],
    [C.safe, "dash", "Safe-зона"],
    [C.dim, "solid", "Размерная линия (мм)"],
    [C.anchor, "dash", "Отсчёт от горловины"],
  ] as const;
  let legend = `<g data-legend="1"><text x="${x}" y="${cy}" font-size="6" font-weight="700" fill="${C.hint}" letter-spacing="0.3">КОНВЕНЦИИ ЛИНИЙ</text>`;
  cy += 7;
  for (const [col, kind, text] of legendRows) {
    legend += `<line x1="${x}" y1="${cy - 1.5}" x2="${x + 9}" y2="${cy - 1.5}" stroke="${col}" stroke-width="1.3" ${kind === "dash" ? 'stroke-dasharray="3 2"' : ""}/>
      <text x="${x + 13}" y="${cy}" font-size="6.5" fill="${C.body}">${esc(text)}</text>`;
    cy += 7.5;
  }
  legend += "</g>";

  // Инфо-плашка
  cy += 3;
  const info = `<rect x="${x}" y="${cy}" width="${w}" height="18" rx="2.5" fill="${C.blue50}" stroke="${C.blue100}" stroke-width="0.5"/>
    <text x="${x + 5}" y="${cy + 7.5}" font-size="6" fill="${C.blue700}">Положение пересчитывается от горловины —</text>
    <text x="${x + 5}" y="${cy + 14}" font-size="6" fill="${C.blue700}">отступ постоянен на всех ростовках.</text>`;

  return `<g data-spec="1">${blocks.join("\n")}${legend}${info}</g>`;
}

/** Собрать SVG тех-листа. Рисунок 1:1 в мм; страница в мм. */
export function buildSceneSvg(input: SceneInput): string {
  const { view, flatMm, placements, assets, sku, meta } = input;
  const isProd = input.variant === "production";

  // Раскладка (мм)
  const PAD = 14;
  const TITLE_H = 54;
  const FOOTER_H = 22;
  const GAP = 16;
  const SPEC_W = isProd ? 0 : 150;
  const drawW = flatMm.w;
  const drawH = flatMm.h;
  const W = PAD + drawW + (isProd ? 0 : GAP + SPEC_W) + PAD;
  const H = TITLE_H + drawH + FOOTER_H + PAD;
  const DX = PAD;
  const DY = TITLE_H;

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

  // Зоны печати + safe-зоны (только в full).
  const zonesSvg = isProd
    ? ""
    : [...new Set(placements.map((p) => p.print_area_id))]
        .map((areaId) => {
          const { zone, safeInsetMm } = viewZone(view, meta.size, areaId);
          return `<rect x="${zone.zx}" y="${zone.zy}" width="${zone.zw}" height="${zone.zh}" fill="${C.zoneFill}" stroke="${C.zone}" stroke-width="1.2" stroke-dasharray="8 6"/>
        <rect x="${zone.zx + safeInsetMm}" y="${zone.zy + safeInsetMm}" width="${zone.zw - 2 * safeInsetMm}" height="${zone.zh - 2 * safeInsetMm}" fill="none" stroke="${C.safe}" stroke-width="0.8" stroke-dasharray="4 4"/>`;
        })
        .join("\n");

  const dimsSvg = isProd
    ? ""
    : placements
        .map((p) => {
          const scene = buildDimensionLines(
            view,
            { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
            p.rotation_deg,
            meta.size,
            p.print_area_id,
          );
          const { aabb, zone, centerX, anchorY, lines } = scene;
          const midX = aabb.x + aabb.w / 2;
          const midY = aabb.y + aabb.h / 2;
          const line = (k: (typeof lines)[number]["kind"]) =>
            lines.find((l) => l.kind === k)!;
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
          const wh = `${Math.round(aabb.w)}×${Math.round(aabb.h)} мм`;
          const whHalfW = wh.length * 3.6 + 3;
          const tol =
            p.tolerance_mm && p.tolerance_mm > 0 ? ` ±${p.tolerance_mm}` : "";
          const nl = `${Math.round(vAnchor.value)}${tol}`;
          const nlW = nl.length * 3.5 + 6;
          const nlY = (anchorY + midY) / 2;
          // Плашка Ш×В у верха нанесения (не закрывает центр макета).
          const whY = aabb.y + 3;
          return `
        ${edges}
        <line x1="${vAnchor.from.x}" y1="${vAnchor.from.y}" x2="${vAnchor.to.x}" y2="${vAnchor.to.y}" stroke="${C.anchor}" stroke-width="1" stroke-dasharray="5 4"/>
        <rect x="${centerX - 5 - nlW}" y="${nlY - 9}" width="${nlW}" height="12" rx="2" fill="${C.halo}"/>
        <text x="${centerX - 8}" y="${nlY}" font-size="11" fill="${C.anchor}" text-anchor="end" style="font-variant-numeric:tabular-nums">${nl}</text>
        <circle cx="${centerX}" cy="${anchorY}" r="3" fill="${C.anchor}"/>
        <line x1="${centerX}" y1="${zone.zy}" x2="${centerX}" y2="${zone.zy + zone.zh}" stroke="${C.zone}" stroke-width="0.7" stroke-dasharray="3 5" opacity="0.6"/>
        ${dimArrow(hAnchor.from.x, hAnchor.from.y, hAnchor.to.x, hAnchor.to.y, `${Math.round(hAnchor.value)}`, false)}
        <rect x="${midX - whHalfW}" y="${whY}" width="${whHalfW * 2}" height="16" rx="2" fill="${C.zone}"/>
        <text x="${midX}" y="${whY + 11}" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle" style="font-variant-numeric:tabular-nums">${esc(wh)}</text>`;
        })
        .join("\n");

  const dividerTop = `<line x1="14" y1="${TITLE_H - 6}" x2="${W - 14}" y2="${TITLE_H - 6}" stroke="${C.line}" stroke-width="0.6"/>`;
  const footerY = H - FOOTER_H + 6;
  const footer = `<line x1="14" y1="${footerY - 7}" x2="${W - 14}" y2="${footerY - 7}" stroke="${C.line}" stroke-width="0.6"/>
    <text x="14" y="${footerY}" font-size="6.5" fill="${C.hint}" style="font-variant-numeric:tabular-nums">Масштаб 1:1 · единицы — мм · сгенерировано PINHEAD${isProd ? " · ЛИСТ ДЛЯ ЦЕХА (без обвязки)" : ""}</text>
    <text x="${W - 14}" y="${footerY}" font-size="6.5" fill="${C.hint}" text-anchor="end">Согласовано (цех): ____________   Дата: __________</text>`;

  const drawing = `<g transform="translate(${DX} ${DY})">
    <g data-layer="garment" transform="scale(${input.scaleMmPerUnit ?? 1})">${innerSvg(recolorGarment(input.flatSvgMarkup, input.garmentColor ?? ""))}</g>
    ${isProd ? "" : `<g data-layer="zones">${zonesSvg}</g>`}
    <g data-layer="production-artwork">${placementSvg}</g>
    <g data-layer="markup">
      ${dimsSvg}
      ${calibrationBar(drawW - 110, drawH - 6)}
    </g>
  </g>`;

  const spec = isProd
    ? ""
    : specPanel(DX + drawW + GAP, DY, SPEC_W, view, placements, assets, meta.size);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
      <path d="M0,4 L8,1 L8,7 Z" fill="${C.dim}"/>
    </marker>
    ${clipDefs}
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
  ${titleBlock(W, sku, view, meta)}
  ${dividerTop}
  ${drawing}
  ${spec}
  ${footer}
</svg>`;
}
