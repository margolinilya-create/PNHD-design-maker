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
    | { kind: "sleeve"; vertical: number; horizontal: number };
}

const isSleeve = (view: View) =>
  view.kind === "sleeve_left" || view.kind === "sleeve_right";

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

/** Печатная зона вида (в MVP — первая). */
export function viewZone(view: View): { zone: Zone; safeInsetMm: number } {
  const area = view.print_areas[0];
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
): PlacementInfo {
  const aabb = rotatedAabb(bbox, rotationDeg);
  const { zone, safeInsetMm } = viewZone(view);
  const dimensions = fullDimensions(aabb, zone);
  const check = checkZone(aabb, zone, safeInsetMm);
  const anchors = size ? anchorsForSize(view, size) : view.anchors;

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
