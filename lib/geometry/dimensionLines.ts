// Обвязка как СТРУКТУРНЫЙ объект (S2.1, скил merch-geometry).
// Единый источник правды размерных линий: каждая линия ссылается на две точки
// изделия/зоны, а её число ВЫЧИСЛЯЕТСЯ из геометрии (мм). И холст, и PDF берут
// одни и те же значения — нет «нарисованных» линий, расходящихся с расчётом.
import type { View } from "@/types";
import type { Bbox, Zone } from "./coords";
import { placementInfo, anchorsForSize } from "./view";

export type DimensionKind =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "vertical-anchor"
  | "horizontal-anchor";

export interface DimensionLine {
  kind: DimensionKind;
  /** Концы линии в мм (координаты вида). */
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Вычисленное значение в мм (может быть отрицательным = выход за зону). */
  value: number;
  /** Подсветка проблемы (значение < 0). */
  danger: boolean;
}

export interface DimensionScene {
  aabb: Bbox;
  zone: Zone;
  /** Ось отсчёта по горизонтали (center_axis_x / sleeve_center_x / центр зоны). */
  centerX: number;
  /** Точка отсчёта по вертикали (горловина / низ рукава / верх зоны). */
  anchorY: number;
  printWidth: number;
  printHeight: number;
  lines: DimensionLine[];
}

/**
 * Построить обвязку нанесения как набор размерных линий.
 * Значения берутся из `placementInfo` (та же геометрия, что и на холсте).
 */
export function buildDimensionLines(
  view: View,
  bbox: Bbox,
  rotationDeg: number,
  size?: string,
  areaId?: string,
): DimensionScene {
  const info = placementInfo(view, bbox, rotationDeg, size, areaId);
  const { aabb, zone, dimensions: d, anchor } = info;
  const midX = aabb.x + aabb.w / 2;
  const midY = aabb.y + aabb.h / 2;

  const anchors = size ? anchorsForSize(view, size) : view.anchors;
  const centerX =
    anchor.kind === "sleeve"
      ? (anchors.sleeve_center_x ?? midX)
      : anchor.kind === "panel"
        ? zone.zx + zone.zw / 2
        : (anchors.center_axis_x ?? midX);
  const anchorY =
    anchor.kind === "sleeve"
      ? (anchors.sleeve_bottom_y ?? zone.zy + zone.zh)
      : anchor.kind === "panel"
        ? zone.zy
        : (anchors.neckline_point?.y ?? zone.zy);

  const lines: DimensionLine[] = [
    {
      kind: "left",
      from: { x: zone.zx, y: midY },
      to: { x: aabb.x, y: midY },
      value: d.left,
      danger: d.left < 0,
    },
    {
      kind: "right",
      from: { x: aabb.x + aabb.w, y: midY },
      to: { x: zone.zx + zone.zw, y: midY },
      value: d.right,
      danger: d.right < 0,
    },
    {
      kind: "top",
      from: { x: midX, y: zone.zy },
      to: { x: midX, y: aabb.y },
      value: d.top,
      danger: d.top < 0,
    },
    {
      kind: "bottom",
      from: { x: midX, y: aabb.y + aabb.h },
      to: { x: midX, y: zone.zy + zone.zh },
      value: d.bottom,
      danger: d.bottom < 0,
    },
    {
      kind: "vertical-anchor",
      from: { x: centerX, y: anchorY },
      to: { x: centerX, y: midY },
      value: Math.abs(anchor.vertical),
      danger: false,
    },
    {
      kind: "horizontal-anchor",
      from: { x: centerX, y: midY },
      to: { x: midX, y: midY },
      value: anchor.horizontal,
      danger: false,
    },
  ];

  return {
    aabb,
    zone,
    centerX,
    anchorY,
    printWidth: d.printWidth,
    printHeight: d.printHeight,
    lines,
  };
}
