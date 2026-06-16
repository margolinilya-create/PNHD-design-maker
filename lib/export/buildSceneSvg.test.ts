import { describe, it, expect } from "vitest";
import { buildSceneSvg } from "./buildSceneSvg";
import type { SKU, View } from "@/types";

const view: View = {
  id: "v-front",
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

const sku: SKU = {
  id: "tshirt-classic",
  name: "Футболка",
  type: "tshirt",
  base_size: "L",
  sizes: ["L"],
  views: [view],
};

function scene() {
  return buildSceneSvg({
    sku,
    view,
    flatSvgMarkup: '<svg viewBox="0 0 600 760" width="600" height="760"></svg>',
    flatMm: { w: 600, h: 760 },
    placements: [],
    assets: {},
    meta: { client: "", orderRef: "", size: "L", date: "16.06.2026" },
  });
}

describe("buildSceneSvg — масштаб и калибровка", () => {
  it("страница в мм (1:1): width/height в мм", () => {
    const svg = scene();
    expect(svg).toMatch(/width="600mm"/);
    expect(svg).toMatch(/height="820mm"/); // 760 флэт + 60 рамка
    expect(svg).toMatch(/viewBox="0 0 600 820"/);
  });

  it("содержит калибровочную шкалу ровно 100 мм", () => {
    const svg = scene();
    expect(svg).toContain('data-calibration-mm="100"');
    // Линия шкалы: длина x2−x1 = 100 мм.
    const m = svg.match(
      /<line x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)" y2="[\d.]+" stroke="#111" stroke-width="0\.75"\/>/,
    );
    expect(m).not.toBeNull();
    const x1 = parseFloat(m![1]);
    const x2 = parseFloat(m![2]);
    expect(x2 - x1).toBeCloseTo(100, 6);
  });
});
