import { describe, it, expect } from "vitest";
import { reviewGrading } from "./gradingReview";
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
  size_anchors: {
    S: anchor(52),
    M: anchor(92),
    L: anchor(132),
    XL: anchor(172),
  },
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

const sizes = ["S", "M", "L", "XL"];

// Нанесение у нижнего края на M: при росте размера горловина уходит вниз →
// нанесение (константа отступа от горловины) тоже уходит и вылетает за зону.
const p: Placement = {
  id: "p1",
  print_area_id: "chest",
  asset_id: "a1",
  x_mm: 250,
  y_mm: 420,
  width_mm: 100,
  height_mm: 100,
  rotation_deg: 0,
};

describe("reviewGrading — свод по ростовке", () => {
  const rows = reviewGrading(view, [p], sizes, "M");

  it("строка на каждый размер, элемент на каждое нанесение вида", () => {
    expect(rows.map((r) => r.size)).toEqual(sizes);
    expect(rows.every((r) => r.items.length === 1)).toBe(true);
  });

  it("на базовом M помещается, на XL вылетает за зону", () => {
    const m = rows.find((r) => r.size === "M")!;
    const xl = rows.find((r) => r.size === "XL")!;
    expect(m.anyOut).toBe(false);
    expect(m.items[0].minMargin).toBeGreaterThanOrEqual(0);
    expect(xl.anyOut).toBe(true);
    expect(xl.items[0].outOfZone).toBe(true);
    expect(xl.items[0].minMargin).toBeLessThan(0);
  });

  it("размер печати константа на всех ростовках", () => {
    for (const r of rows) {
      expect(r.items[0].printWidth).toBe(100);
      expect(r.items[0].printHeight).toBe(100);
    }
  });

  it("берёт только нанесения текущего вида", () => {
    const other: Placement = { ...p, id: "p2", print_area_id: "other-zone" };
    const rows2 = reviewGrading(view, [p, other], sizes, "M");
    expect(rows2[0].items).toHaveLength(1); // p2 отфильтровано
  });
});
