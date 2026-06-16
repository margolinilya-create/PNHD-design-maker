// Модель черновика лекала из «Редактора лекал» → запись SKU для каталога.
import type { SKU, View, ViewKind, GarmentType, BaseSize } from "@/types";
import { catalogSchema } from "@/lib/catalog/schema";

export interface ZoneDraft {
  id: string;
  name: string;
  x: number; // мм
  y: number;
  w: number;
  h: number;
  safe_inset_mm: number;
}

export interface FlatDraft {
  skuId: string;
  skuName: string;
  type: GarmentType;
  baseSize: BaseSize;
  viewKind: ViewKind;
  flatDataUrl: string; // загруженный флэт (data URL) — для превью
  scaleMmPerUnit: number; // калибровка единиц SVG/изображения → мм
  // Якоря в мм (в системе координат флэта).
  neckline: { x: number; y: number };
  centerAxisX: number;
  sleeveBottomY: number;
  sleeveCenterX: number;
  zone: ZoneDraft;
}

const isSleeveKind = (k: ViewKind) =>
  k === "sleeve_left" || k === "sleeve_right";

/** Якоря вида по типу (front/back vs sleeve). */
export function draftAnchors(d: FlatDraft) {
  return isSleeveKind(d.viewKind)
    ? { sleeve_bottom_y: d.sleeveBottomY, sleeve_center_x: d.sleeveCenterX }
    : { neckline_point: { x: d.neckline.x, y: d.neckline.y }, center_axis_x: d.centerAxisX };
}

/** Печатная зона черновика → polygon_mm. */
export function zonePolygon(z: ZoneDraft): [number, number][] {
  return [
    [z.x, z.y],
    [z.x + z.w, z.y],
    [z.x + z.w, z.y + z.h],
    [z.x, z.y + z.h],
  ];
}

/** Собрать SKU c одним видом из черновика (флэт — data URL). */
export function buildSkuFromDraft(d: FlatDraft): SKU {
  const view: View = {
    id: `${d.skuId}-${d.viewKind}`,
    kind: d.viewKind,
    flat_svg: d.flatDataUrl,
    scale_mm_per_unit: d.scaleMmPerUnit,
    anchors: draftAnchors(d),
    print_areas: [
      {
        id: d.zone.id,
        name: d.zone.name,
        polygon_mm: zonePolygon(d.zone),
        safe_inset_mm: d.zone.safe_inset_mm,
      },
    ],
  };
  return {
    id: d.skuId,
    name: d.skuName,
    type: d.type,
    base_size: d.baseSize,
    sizes: [d.baseSize],
    views: [view],
  };
}

/** Проверка черновика по схеме каталога. Возвращает список ошибок (пусто — ок). */
export function validateDraft(d: FlatDraft): string[] {
  const res = catalogSchema.safeParse({ skus: [buildSkuFromDraft(d)] });
  if (res.success) return [];
  return res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

// ── Черновики в localStorage (превью в каталоге до сохранения файлов) ──
const DRAFT_KEY = "pinhead.flatDrafts";

export function loadDraftSkus(): SKU[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SKU[]) : [];
  } catch {
    return [];
  }
}

export function saveDraftSku(sku: SKU): void {
  if (typeof window === "undefined") return;
  const list = loadDraftSkus().filter((s) => s.id !== sku.id);
  list.push(sku);
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(list));
}

export function removeDraftSku(id: string): void {
  if (typeof window === "undefined") return;
  const list = loadDraftSkus().filter((s) => s.id !== id);
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(list));
}
