import { describe, it, expect } from "vitest";
import { buildDimensionLines } from "./dimensionLines";
import type { View } from "@/types";

const view: View = {
  id: "v",
  kind: "front",
  flat_svg: "",
  scale_mm_per_unit: 1,
  anchors: { neckline_point: { x: 300, y: 92 }, center_axis_x: 300 },
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
      safe_inset_mm: 15,
    },
  ],
};

const find = (
  s: ReturnType<typeof buildDimensionLines>,
  k: string,
) => s.lines.find((l) => l.kind === k)!;

describe("buildDimensionLines — обвязка как объект", () => {
  const scene = buildDimensionLines(
    view,
    { x: 200, y: 200, w: 100, h: 100 },
    0,
    undefined,
    "chest",
  );

  it("ровно 6 размерных линий", () => {
    expect(scene.lines).toHaveLength(6);
  });

  it("отступы до краёв зоны вычислены из геометрии (мм)", () => {
    expect(find(scene, "left").value).toBe(50); // 200−150
    expect(find(scene, "right").value).toBe(150); // 450−300
    expect(find(scene, "top").value).toBe(60); // 200−140
    expect(find(scene, "bottom").value).toBe(240); // 540−300
  });

  it("вертикаль от горловины и горизонталь от центра", () => {
    const v = find(scene, "vertical-anchor");
    expect(v.value).toBe(108); // 200 − 92
    expect(v.from).toEqual({ x: 300, y: 92 }); // от горловины
    expect(v.to).toEqual({ x: 300, y: 250 }); // до центра макета
    expect(find(scene, "horizontal-anchor").value).toBe(-50); // (250) − 300
  });

  it("линии ссылаются на точки зоны/макета (не нарисованы)", () => {
    expect(find(scene, "left").from).toEqual({ x: 150, y: 250 }); // край зоны
    expect(find(scene, "left").to).toEqual({ x: 200, y: 250 }); // край макета
  });

  it("число пересчитывается при сдвиге макета (single source)", () => {
    const moved = buildDimensionLines(
      view,
      { x: 250, y: 200, w: 100, h: 100 },
      0,
      undefined,
      "chest",
    );
    expect(find(moved, "left").value).toBe(100); // 250−150 (было 50)
  });

  it("выход за зону → danger на соответствующей линии", () => {
    const out = buildDimensionLines(
      view,
      { x: 140, y: 200, w: 100, h: 100 }, // x<150 → left отрицательный
      0,
      undefined,
      "chest",
    );
    expect(find(out, "left").value).toBeLessThan(0);
    expect(find(out, "left").danger).toBe(true);
    expect(find(out, "right").danger).toBe(false);
  });
});
