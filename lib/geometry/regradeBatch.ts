// Батч-регрейд (P1 #20): пересчёт позиций всех нанесений под целевой размер
// (константа отступа от горловины). Чистая функция — для сборки batch-PDF.
import type { Placement, View } from "@/types";
import { regradePosition } from "./view";

function viewForPlacement(views: View[], p: Placement): View | undefined {
  return views.find((v) => v.print_areas.some((a) => a.id === p.print_area_id));
}

/**
 * Регрейд всех нанесений с `fromSize` на `toSize`.
 * Размер печати сохраняется; меняется только позиция по per-size якорям.
 */
export function regradePlacementsToSize(
  views: View[],
  placements: Placement[],
  fromSize: string,
  toSize: string,
): Placement[] {
  if (fromSize === toSize) return placements;
  return placements.map((p) => {
    const view = viewForPlacement(views, p);
    if (!view) return p;
    const { x_mm, y_mm } = regradePosition(view, fromSize, toSize, {
      x: p.x_mm,
      y: p.y_mm,
      w: p.width_mm,
      h: p.height_mm,
    });
    return { ...p, x_mm, y_mm };
  });
}
