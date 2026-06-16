// Grading — КОНСТАНТА отступа от горловины (BUILD.md §4, решение #4).
// При смене размера сохраняем vertical_from_neckline, horizontal_from_center
// и размер печати; пересчитываем только положение по per-size якорям.

import type { Bbox } from "./coords";
import {
  horizontalFromCenter,
  verticalFromNeckline,
  verticalFromBottom,
} from "./dimension";

/** Инвариант размещения, сохраняемый при смене ростовки. */
export interface PlacementInvariant {
  vertical_from_neckline: number;
  horizontal_from_center: number;
  printWidth: number;
  printHeight: number;
}

/** Снять инвариант с текущего bbox (front/back). */
export function captureInvariant(
  bbox: Bbox,
  necklineY: number,
  centerAxisX: number,
): PlacementInvariant {
  return {
    vertical_from_neckline: verticalFromNeckline(bbox, necklineY),
    horizontal_from_center: horizontalFromCenter(bbox, centerAxisX),
    printWidth: bbox.w,
    printHeight: bbox.h,
  };
}

/**
 * Применить инвариант к новым якорям (новый размер).
 * bbox.y' = neckline'.y + vertical_from_neckline;
 * bbox.center_x' = center_axis_x' + horizontal_from_center.
 * Размер печати не меняется.
 */
export function applyInvariantFrontBack(
  inv: PlacementInvariant,
  necklineY: number,
  centerAxisX: number,
): Bbox {
  const w = inv.printWidth;
  const h = inv.printHeight;
  const y = necklineY + inv.vertical_from_neckline;
  const centerX = centerAxisX + inv.horizontal_from_center;
  return { x: centerX - w / 2, y, w, h };
}

/** Инвариант для рукава (от нижнего края рукава вверх). */
export interface SleeveInvariant {
  vertical_from_bottom: number;
  horizontal_from_center: number;
  printWidth: number;
  printHeight: number;
}

export function captureSleeveInvariant(
  bbox: Bbox,
  sleeveBottomY: number,
  sleeveCenterX: number,
): SleeveInvariant {
  return {
    vertical_from_bottom: verticalFromBottom(bbox, sleeveBottomY),
    horizontal_from_center: horizontalFromCenter(bbox, sleeveCenterX),
    printWidth: bbox.w,
    printHeight: bbox.h,
  };
}

export function applyInvariantSleeve(
  inv: SleeveInvariant,
  sleeveBottomY: number,
  sleeveCenterX: number,
): Bbox {
  const w = inv.printWidth;
  const h = inv.printHeight;
  // vertical_from_bottom = sleeveBottomY − (y + h) → y = sleeveBottomY − h − vfb
  const y = sleeveBottomY - h - inv.vertical_from_bottom;
  const centerX = sleeveCenterX + inv.horizontal_from_center;
  return { x: centerX - w / 2, y, w, h };
}
