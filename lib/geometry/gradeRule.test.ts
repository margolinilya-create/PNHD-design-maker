import { describe, it, expect } from "vitest";
import { gradedAnchors, expandGradeRule } from "./gradeRule";
import { regradePosition } from "./view";
import type { View } from "@/types";

const baseView: View = {
  id: "v",
  kind: "front",
  flat_svg: "",
  scale_mm_per_unit: 1,
  anchors: { neckline_point: { x: 300, y: 92 }, center_axis_x: 300 },
  grade_rule: { neckline: { dy: 4 }, center_axis_dx: 2 },
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

const sizes = ["S", "M", "L", "XL"];

describe("gradedAnchors — линейное применение дельт", () => {
  it("шаг вверх и вниз от базового", () => {
    const up = gradedAnchors(baseView.anchors, baseView.grade_rule!, 1);
    expect(up.neckline_point?.y).toBe(96); // 92 + 4
    expect(up.center_axis_x).toBe(302); // 300 + 2
    const down = gradedAnchors(baseView.anchors, baseView.grade_rule!, -1);
    expect(down.neckline_point?.y).toBe(88); // 92 − 4
  });
});

describe("expandGradeRule — разворот в size_anchors", () => {
  const v = expandGradeRule(baseView, sizes, "M");
  it("заполняет все размеры от базового", () => {
    expect(v.size_anchors?.S.neckline_point?.y).toBe(88); // step −1
    expect(v.size_anchors?.M.neckline_point?.y).toBe(92); // base
    expect(v.size_anchors?.L.neckline_point?.y).toBe(96); // +1
    expect(v.size_anchors?.XL.neckline_point?.y).toBe(100); // +2
  });

  it("явные size_anchors приоритетнее правила", () => {
    const withExplicit: View = {
      ...baseView,
      size_anchors: { L: { neckline_point: { x: 300, y: 999 }, center_axis_x: 300 } },
    };
    const e = expandGradeRule(withExplicit, sizes, "M");
    expect(e.size_anchors?.L.neckline_point?.y).toBe(999); // не перетёрто
    expect(e.size_anchors?.S.neckline_point?.y).toBe(88); // остальные — из правила
  });

  it("без grade_rule возвращает вид без изменений", () => {
    const plain: View = { ...baseView, grade_rule: undefined };
    expect(expandGradeRule(plain, sizes, "M").size_anchors).toBeUndefined();
  });
});

describe("grade-rule + регрейдинг — отступ от горловины КОНСТАНТА", () => {
  const v = expandGradeRule(baseView, sizes, "M");
  it("после смены размера отступ от горловины сохраняется", () => {
    const bbox = { x: 250, y: 200, w: 100, h: 80 };
    const offsetM = bbox.y - v.size_anchors!.M.neckline_point!.y; // 200 − 92 = 108
    const moved = regradePosition(v, "M", "XL", bbox);
    const offsetXL = moved.y_mm - v.size_anchors!.XL.neckline_point!.y;
    expect(offsetXL).toBeCloseTo(offsetM, 6); // константа
    expect(moved.y_mm).toBe(208); // 100 (горловина XL) + 108
  });
});
