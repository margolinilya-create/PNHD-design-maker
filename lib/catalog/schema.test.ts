import { describe, it, expect } from "vitest";
import { skuSchema } from "./schema";

// Минимальный валидный SKU для проверки условных требований к якорям.
const base = (type: string, anchors: object, extra: object = {}) => ({
  id: "x",
  name: "X",
  type,
  base_size: "M",
  sizes: ["M"],
  views: [
    {
      id: "x-front",
      kind: "front",
      flat_svg: "/x.svg",
      scale_mm_per_unit: 1,
      anchors,
      print_areas: [
        {
          id: "front",
          name: "Перёд",
          polygon_mm: [
            [50, 100],
            [150, 100],
            [150, 200],
            [50, 200],
          ],
          safe_inset_mm: 10,
        },
      ],
      ...extra,
    },
  ],
});

describe("skuSchema — якоря front/back по категории", () => {
  it("одежда: front без neckline_point невалиден", () => {
    const r = skuSchema.safeParse(base("tshirt", { center_axis_x: 100 }));
    expect(r.success).toBe(false);
  });

  it("аксессуар (шоппер): front без neckline_point валиден", () => {
    const r = skuSchema.safeParse(base("shopper", { center_axis_x: 100 }));
    expect(r.success).toBe(true);
  });

  it("аксессуар: center_axis_x всё равно обязателен", () => {
    const r = skuSchema.safeParse(base("shopper", {}));
    expect(r.success).toBe(false);
  });

  it("аксессуар: присутствующая горловина не запрещена (легаси)", () => {
    const r = skuSchema.safeParse(
      base("shopper", {
        neckline_point: { x: 100, y: 50 },
        center_axis_x: 100,
      }),
    );
    expect(r.success).toBe(true);
  });

  it("аксессуар: per-size якоря без neckline_point валидны", () => {
    const r = skuSchema.safeParse(
      base(
        "shopper",
        { center_axis_x: 100 },
        { size_anchors: { M: { center_axis_x: 102 } } },
      ),
    );
    expect(r.success).toBe(true);
  });

  it("одежда: per-size якоря без neckline_point невалидны", () => {
    const r = skuSchema.safeParse(
      base(
        "tshirt",
        { neckline_point: { x: 100, y: 50 }, center_axis_x: 100 },
        { size_anchors: { M: { center_axis_x: 102 } } },
      ),
    );
    expect(r.success).toBe(false);
  });
});
