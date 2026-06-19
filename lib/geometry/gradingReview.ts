// Проверка ростовки (P1 #12): прогон нанесений вида по ВСЕМ размерам.
// Для каждого размера регрейдим позицию (константа отступа от горловины) и считаем
// выход за зону и минимальный отступ — ловим вылет на крайних ростовках до экспорта.
import type { Placement, View } from "@/types";
import { regradePosition, placementInfo } from "./view";

export interface GradingReviewItem {
  placementId: string;
  name: string;
  outOfZone: boolean;
  /** Минимальный отступ до краёв зоны (мм); < 0 = выход. */
  minMargin: number;
  printWidth: number;
  printHeight: number;
}

export interface GradingReviewRow {
  size: string;
  items: GradingReviewItem[];
  anyOut: boolean;
}

function placementName(view: View, p: Placement): string {
  return (
    p.name ||
    view.print_areas.find((a) => a.id === p.print_area_id)?.name ||
    "слой"
  );
}

/**
 * Свод по ростовке для нанесений текущего вида.
 * `fromSize` — размер, на котором заданы текущие позиции нанесений.
 */
export function reviewGrading(
  view: View,
  placements: Placement[],
  sizes: string[],
  fromSize: string,
): GradingReviewRow[] {
  const areaIds = new Set(view.print_areas.map((a) => a.id));
  const vps = placements.filter((p) => areaIds.has(p.print_area_id));

  return sizes.map((size) => {
    const items: GradingReviewItem[] = vps.map((p) => {
      const pos =
        size === fromSize
          ? { x_mm: p.x_mm, y_mm: p.y_mm }
          : regradePosition(view, fromSize, size, {
              x: p.x_mm,
              y: p.y_mm,
              w: p.width_mm,
              h: p.height_mm,
            });
      const info = placementInfo(
        view,
        { x: pos.x_mm, y: pos.y_mm, w: p.width_mm, h: p.height_mm },
        p.rotation_deg,
        size,
        p.print_area_id,
      );
      const d = info.dimensions;
      return {
        placementId: p.id,
        name: placementName(view, p),
        outOfZone: info.check.out_of_zone,
        minMargin: Math.min(d.left, d.right, d.top, d.bottom),
        printWidth: d.printWidth,
        printHeight: d.printHeight,
      };
    });
    return { size, items, anyOut: items.some((i) => i.outOfZone) };
  });
}
