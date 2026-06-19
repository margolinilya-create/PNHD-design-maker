import { describe, it, expect } from "vitest";
import { regradePlacementsToSize } from "./regradeBatch";
import type { Placement, View } from "@/types";

const anchor = (y: number) => ({
  neckline_point: { x: 300, y },
  center_axis_x: 300,
});

const view: View = {
  id: "v",
  kind: "front",
  flat_svg: "",
  scale_mm_per_unit: 1,
  anchors: anchor(92),
  size_anchors: { M: anchor(92), XL: anchor(132) },
  print_areas: [
    {
      id: "chest",
      name: "Грудь",
      polygon_mm: [
        [150, 140],
        [450, 140],
        [450, 540],
        [150, 540],
      ],
      safe_inset_mm: 0,
    },
  ],
};

const p: Placement = {
  id: "p1",
  print_area_id: "chest",
  asset_id: "a1",
  x_mm: 250,
  y_mm: 300,
  width_mm: 100,
  height_mm: 100,
  rotation_deg: 0,
};

describe("regradePlacementsToSize", () => {
  it("тот же размер → без изменений (та же ссылка массива)", () => {
    const arr = [p];
    expect(regradePlacementsToSize([view], arr, "M", "M")).toBe(arr);
  });

  it("регрейд двигает позицию, сохраняя отступ от горловины", () => {
    const [r] = regradePlacementsToSize([view], [p], "M", "XL");
    // offset от горловины M = 300−92 = 208; на XL: 132+208 = 340
    expect(r.y_mm).toBe(340);
    expect(r.width_mm).toBe(100); // размер печати константа
    expect(r.x_mm).toBe(250); // центр не сместился (ось 300)
  });

  it("нанесение без вида остаётся как есть", () => {
    const orphan: Placement = { ...p, print_area_id: "нет" };
    const [r] = regradePlacementsToSize([view], [orphan], "M", "XL");
    expect(r.y_mm).toBe(300);
  });
});
