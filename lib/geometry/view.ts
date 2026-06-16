// Связка View ↔ геометрия размещения (BUILD.md §4).
import type { View } from "@/types";
import { polygonToZone, rotatedAabb, type Bbox, type Zone } from "./coords";
import {
  fullDimensions,
  horizontalFromCenter,
  verticalFromBottom,
  verticalFromNeckline,
  type FullDimensions,
} from "./dimension";
import { checkZone, type ZoneCheck } from "./zone";

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

/** Печатная зона вида (в MVP — первая). */
export function viewZone(view: View): { zone: Zone; safeInsetMm: number } {
  const area = view.print_areas[0];
  return { zone: polygonToZone(area.polygon_mm), safeInsetMm: area.safe_inset_mm };
}

/** Полная геометрия размещения по bbox (top-left, мм) и повороту. */
export function placementInfo(
  view: View,
  bbox: Bbox,
  rotationDeg: number,
): PlacementInfo {
  const aabb = rotatedAabb(bbox, rotationDeg);
  const { zone, safeInsetMm } = viewZone(view);
  const dimensions = fullDimensions(aabb, zone);
  const check = checkZone(aabb, zone, safeInsetMm);

  if (isSleeve(view)) {
    const sb = view.anchors.sleeve_bottom_y ?? zone.zy + zone.zh;
    const sc = view.anchors.sleeve_center_x ?? zone.zx + zone.zw / 2;
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

  const neckY = view.anchors.neckline_point?.y ?? zone.zy;
  const centerX = view.anchors.center_axis_x ?? zone.zx + zone.zw / 2;
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
