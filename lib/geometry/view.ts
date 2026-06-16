// Связка View ↔ геометрия размещения (BUILD.md §4).
import type { View, ViewAnchors } from "@/types";
import { polygonToZone, rotatedAabb, type Bbox, type Zone } from "./coords";
import {
  fullDimensions,
  horizontalFromCenter,
  verticalFromBottom,
  verticalFromNeckline,
  type FullDimensions,
} from "./dimension";
import { checkZone, type ZoneCheck } from "./zone";
import {
  captureInvariant,
  applyInvariantFrontBack,
  captureSleeveInvariant,
  applyInvariantSleeve,
} from "./grading";

export interface PlacementInfo {
  /** AABB макета с учётом поворота (мм). */
  aabb: Bbox;
  zone: Zone;
  safeInsetMm: number;
  dimensions: FullDimensions;
  check: ZoneCheck;
  /** Привязка к якорю изделия. */
  anchor:
    | { kind: "neckline"; vertical: number; horizontal: number }
    | { kind: "sleeve"; vertical: number; horizontal: number }
    | { kind: "panel"; vertical: number; horizontal: number };
}

const isSleeve = (view: View) =>
  view.kind === "sleeve_left" || view.kind === "sleeve_right";
const isLabel = (view: View) => view.kind.startsWith("label");

/** Якоря вида для конкретного размера (фоллбэк на базовые). */
export function anchorsForSize(view: View, size: string): ViewAnchors {
  return view.size_anchors?.[size] ?? view.anchors;
}

/**
 * Регрейдинг положения: при смене размера сохраняем отступ от горловины
 * (для рукава — от нижнего края) и от центра — КОНСТАНТА (BUILD.md решение #4).
 * Возвращает новый top-left bbox (мм); размер печати не меняется.
 */
export function regradePosition(
  view: View,
  fromSize: string,
  toSize: string,
  bbox: Bbox,
): { x_mm: number; y_mm: number } {
  const from = anchorsForSize(view, fromSize);
  const to = anchorsForSize(view, toSize);

  // No-op фоллбэк: без обоих якорей регрейдинг невозможен — НЕ снапим к 0,
  // а возвращаем исходную позицию (иначе ?? 0 молча уводит макет к нулю).
  const noop = { x_mm: bbox.x, y_mm: bbox.y };

  if (isSleeve(view)) {
    if (
      from.sleeve_bottom_y == null ||
      to.sleeve_bottom_y == null ||
      from.sleeve_center_x == null ||
      to.sleeve_center_x == null
    ) {
      return noop;
    }
    const inv = captureSleeveInvariant(
      bbox,
      from.sleeve_bottom_y,
      from.sleeve_center_x,
    );
    const nb = applyInvariantSleeve(inv, to.sleeve_bottom_y, to.sleeve_center_x);
    return { x_mm: nb.x, y_mm: nb.y };
  }

  if (
    from.neckline_point?.y == null ||
    to.neckline_point?.y == null ||
    from.center_axis_x == null ||
    to.center_axis_x == null
  ) {
    return noop;
  }

  const inv = captureInvariant(
    bbox,
    from.neckline_point.y,
    from.center_axis_x,
  );
  const nb = applyInvariantFrontBack(
    inv,
    to.neckline_point.y,
    to.center_axis_x,
  );
  return { x_mm: nb.x, y_mm: nb.y };
}

export type PositionPreset = "center-x" | "center-zone" | "top" | "bottom";

/**
 * Готовая позиция нанесения по пресету (мм). Горизонталь — по оси изделия
 * (center_axis_x / sleeve_center_x), верх/низ — с учётом safe-inset зоны.
 */
export function presetPosition(
  view: View,
  bbox: Bbox,
  preset: PositionPreset,
  size?: string,
  areaId?: string,
): { x_mm: number; y_mm: number } {
  const { zone, safeInsetMm } = viewZone(view, size, areaId);
  const anchors = size ? anchorsForSize(view, size) : view.anchors;
  const axis = isSleeve(view)
    ? (anchors.sleeve_center_x ?? zone.zx + zone.zw / 2)
    : (anchors.center_axis_x ?? zone.zx + zone.zw / 2);
  switch (preset) {
    case "center-x":
      return { x_mm: axis - bbox.w / 2, y_mm: bbox.y };
    case "center-zone":
      return { x_mm: axis - bbox.w / 2, y_mm: zone.zy + (zone.zh - bbox.h) / 2 };
    case "top":
      return { x_mm: bbox.x, y_mm: zone.zy + safeInsetMm };
    case "bottom":
      return { x_mm: bbox.x, y_mm: zone.zy + zone.zh - bbox.h - safeInsetMm };
  }
}

/** Флэт вида для размера (фоллбэк на базовый `flat_svg`). */
export function flatForSize(view: View, size?: string): string {
  return (size && view.size_flats?.[size]) || view.flat_svg;
}

/** Печатные зоны вида для размера (фоллбэк на базовые `print_areas`). */
export function printAreasForSize(view: View, size?: string) {
  return (size && view.size_print_areas?.[size]) || view.print_areas;
}

/** Зона по id (для мультизонных видов); фоллбэк на первую. */
export function findPrintArea(view: View, areaId?: string, size?: string) {
  const areas = printAreasForSize(view, size);
  return (areaId && areas.find((a) => a.id === areaId)) || areas[0];
}

/** Печатная зона вида по id зоны (или первая), с учётом per-size зон. */
export function viewZone(
  view: View,
  size?: string,
  areaId?: string,
): { zone: Zone; safeInsetMm: number } {
  const area = findPrintArea(view, areaId, size);
  return { zone: polygonToZone(area.polygon_mm), safeInsetMm: area.safe_inset_mm };
}

/**
 * Полная геометрия размещения по bbox (top-left, мм) и повороту.
 * `size` (опц.) выбирает per-size якоря; иначе — базовые.
 */
export function placementInfo(
  view: View,
  bbox: Bbox,
  rotationDeg: number,
  size?: string,
  areaId?: string,
): PlacementInfo {
  const aabb = rotatedAabb(bbox, rotationDeg);
  const { zone, safeInsetMm } = viewZone(view, size, areaId);
  const dimensions = fullDimensions(aabb, zone);
  const check = checkZone(aabb, zone, safeInsetMm);
  const anchors = size ? anchorsForSize(view, size) : view.anchors;

  if (isLabel(view)) {
    // Этикетка — панельный вид: отсчёт от верха и центра зоны.
    return {
      aabb,
      zone,
      safeInsetMm,
      dimensions,
      check,
      anchor: {
        kind: "panel",
        vertical: aabb.y - zone.zy,
        horizontal: aabb.x + aabb.w / 2 - (zone.zx + zone.zw / 2),
      },
    };
  }

  if (isSleeve(view)) {
    const sb = anchors.sleeve_bottom_y ?? zone.zy + zone.zh;
    const sc = anchors.sleeve_center_x ?? zone.zx + zone.zw / 2;
    return {
      aabb,
      zone,
      safeInsetMm,
      dimensions,
      check,
      anchor: {
        kind: "sleeve",
        vertical: verticalFromBottom(aabb, sb),
        horizontal: horizontalFromCenter(aabb, sc),
      },
    };
  }

  const neckY = anchors.neckline_point?.y ?? zone.zy;
  const centerX = anchors.center_axis_x ?? zone.zx + zone.zw / 2;
  return {
    aabb,
    zone,
    safeInsetMm,
    dimensions,
    check,
    anchor: {
      kind: "neckline",
      vertical: verticalFromNeckline(aabb, neckY),
      horizontal: horizontalFromCenter(aabb, centerX),
    },
  };
}
