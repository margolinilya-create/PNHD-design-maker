// Сборка полного SKU из DXF: виды (перёд/спина/оба рукава) + per-size якоря
// и зоны. TS-порт scripts/dxf_build_sku.py.
import type { SKU, View, ViewKind, PrintArea, ViewAnchors, GarmentType } from "@/types";
import { parseDxf, processPiece, type PieceRef, type ProcessedPiece } from "./dxf";

type Parsed = ReturnType<typeof parseDxf>;

const SIZE_ORDER = ["2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];

function sortSizes(tokens: string[]): string[] {
  return [...tokens].sort(
    (a, b) =>
      (SIZE_ORDER.indexOf(a) + 1 || 99) - (SIZE_ORDER.indexOf(b) + 1 || 99),
  );
}

function dataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function rect(x: number, y: number, w: number, h: number): [number, number][] {
  return [
    [r1(x), r1(y)],
    [r1(x + w), r1(y)],
    [r1(x + w), r1(y + h)],
    [r1(x), r1(y + h)],
  ];
}
const r1 = (v: number) => Math.round(v * 10) / 10;

export interface DxfSkuOptions {
  skuId: string;
  skuName: string;
  type?: GarmentType;
}

/** Найти ref детали по ключевому слову имени и размеру. */
function refFor(pieces: PieceRef[], keyword: string, sizeLabel: string) {
  return pieces.find(
    (p) => p.piece.toLowerCase().includes(keyword) && p.size === sizeLabel,
  );
}

/** Применить константную ось центра к якорям (для согласованного грейдинга). */
function forceCenter(a: ViewAnchors, cx: number): ViewAnchors {
  if (a.neckline_point) {
    return { neckline_point: { x: cx, y: a.neckline_point.y }, center_axis_x: cx };
  }
  if (a.sleeve_bottom_y !== undefined) {
    return { sleeve_bottom_y: a.sleeve_bottom_y, sleeve_center_x: cx };
  }
  return a;
}

function buildView(
  parsed: Parsed,
  keyword: string,
  viewKind: ViewKind,
  sizes: string[],
  baseLabel: string,
  zone: { id: string; name: string; w: number; h: number; topOff: number; safe: number },
  viewId: string,
): View | null {
  const baseRef = refFor(parsed.pieces, keyword, baseLabel);
  if (!baseRef) return null;
  const base = processPiece(parsed.blocks, baseRef);
  const cx = base.cx;
  const isSleeve = viewKind === "sleeve_left" || viewKind === "sleeve_right";

  const sizeAnchors: Record<string, ViewAnchors> = {};
  const sizePrintAreas: Record<string, PrintArea[]> = {};

  for (const tok of sizes) {
    const ref = refFor(parsed.pieces, keyword, labelFor(parsed.pieces, tok));
    if (!ref) continue;
    const r: ProcessedPiece = processPiece(parsed.blocks, ref);
    sizeAnchors[tok] = forceCenter(r.anchors, cx);
    // Зона масштабируется по габаритам детали размера.
    const sw = zone.w * (r.wMm / base.wMm);
    const sh = zone.h * (r.hMm / base.hMm);
    const top = isSleeve ? r.hMm * 0.22 : (r.necklineY ?? 0) + zone.topOff;
    sizePrintAreas[tok] = [
      { id: zone.id, name: zone.name, polygon_mm: rect(cx - sw / 2, top, sw, sh), safe_inset_mm: zone.safe },
    ];
  }

  const baseTop = isSleeve ? base.hMm * 0.22 : (base.necklineY ?? 0) + zone.topOff;
  return {
    id: viewId,
    kind: viewKind,
    flat_svg: dataUrl(base.svg),
    scale_mm_per_unit: 1,
    anchors: forceCenter(base.anchors, cx),
    size_anchors: sizeAnchors,
    print_areas: [
      { id: zone.id, name: zone.name, polygon_mm: rect(cx - zone.w / 2, baseTop, zone.w, zone.h), safe_inset_mm: zone.safe },
    ],
    size_print_areas: sizePrintAreas,
  };
}

/** Сопоставить токен размера ('M') с меткой в DXF ('M-176'). */
function labelFor(pieces: PieceRef[], tok: string): string {
  const hit = pieces.find((p) => p.size.split("-")[0] === tok);
  return hit?.size ?? tok;
}

/** Собрать полный SKU из распарсенного DXF. */
export function buildSkuFromDxf(parsed: Parsed, opts: DxfSkuOptions): SKU {
  const tokens = sortSizes(
    Array.from(new Set(parsed.pieces.map((p) => p.size.split("-")[0]))),
  );
  const baseTok = tokens.includes("M") ? "M" : tokens[Math.floor(tokens.length / 2)];
  const baseLabel = labelFor(parsed.pieces, baseTok);

  const front = buildView(parsed, "pered", "front", tokens, baseLabel,
    { id: "chest", name: "Грудь", w: 280, h: 360, topOff: 80, safe: 20 }, `${opts.skuId}-front`);
  const back = buildView(parsed, "spinka", "back", tokens, baseLabel,
    { id: "back", name: "Спина", w: 300, h: 400, topOff: 90, safe: 20 }, `${opts.skuId}-back`);
  const sleeveL = buildView(parsed, "rukav", "sleeve_left", tokens, baseLabel,
    { id: "sleeve", name: "Рукав", w: 150, h: 95, topOff: 0, safe: 12 }, `${opts.skuId}-sleeve-left`);
  const sleeveR = buildView(parsed, "rukav", "sleeve_right", tokens, baseLabel,
    { id: "sleeve", name: "Рукав", w: 150, h: 95, topOff: 0, safe: 12 }, `${opts.skuId}-sleeve-right`);

  const views = [front, back, sleeveL, sleeveR].filter((v): v is View => v !== null);
  const baseSize = tokens.includes("M") ? "M" : tokens.includes("L") ? "L" : "M";

  return {
    id: opts.skuId,
    name: opts.skuName,
    type: opts.type ?? "tshirt",
    base_size: baseSize === "L" ? "L" : "M",
    sizes: tokens,
    views,
  };
}
