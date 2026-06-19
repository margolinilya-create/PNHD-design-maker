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

  it("scale_mm_per_unit масштабирует флэт и страницу остаётся в мм", () => {
    // Лекало из DXF/AI: 1000×1200 ед при 0.5 мм/ед → 500×600 мм.
    const svg = buildSceneSvg({
      sku,
      view,
      flatSvgMarkup:
        '<svg viewBox="0 0 1000 1200" width="1000" height="1200"><path id="garment" d="M0 0"/></svg>',
      flatMm: { w: 500, h: 600 },
      scaleMmPerUnit: 0.5,
      placements: [],
      assets: {},
      meta: { client: "", orderRef: "", size: "L", date: "16.06.2026" },
    });
    // Флэт обёрнут в scale(0.5), чтобы единицы легли в мм.
    expect(svg).toContain('transform="scale(0.5)"');
    // Страница в мм: 500 шир., 600 флэт + 60 рамка = 660.
    expect(svg).toMatch(/width="500mm"/);
    expect(svg).toMatch(/height="660mm"/);
  });

  it("содержит легенду обозначений тех-чертежа", () => {
    const svg = scene();
    expect(svg).toContain('data-legend="1"');
    expect(svg).toContain("реальный размер печати");
  });

  it("разделяет слои: garment / production-artwork / markup", () => {
    const svg = scene();
    expect(svg).toContain('data-layer="garment"');
    expect(svg).toContain('data-layer="production-artwork"');
    expect(svg).toContain('data-layer="markup"');
  });

  it("method-aware: помечает нанесение методом и режимом цвета", () => {
    const svg = buildSceneSvg({
      sku,
      view,
      flatSvgMarkup: '<svg viewBox="0 0 600 760" width="600" height="760"></svg>',
      flatMm: { w: 600, h: 760 },
      placements: [
        {
          id: "p1",
          print_area_id: "chest",
          asset_id: "a1",
          x_mm: 200,
          y_mm: 200,
          width_mm: 100,
          height_mm: 100,
          rotation_deg: 0,
          method: "screenprint",
          pantone: ["PMS 186 C"],
        },
      ],
      assets: {
        a1: {
          id: "a1",
          type: "png",
          source_file: "logo.png",
          data_url: "data:image/png;base64,AAAA",
          intrinsic_size_mm: { width: 100, height: 100 },
        },
      },
      meta: { client: "", orderRef: "", size: "L", date: "16.06.2026" },
    });
    // production-группа несёт метод и режим цвета
    expect(svg).toContain('data-method="screenprint"');
    expect(svg).toContain('data-color-mode="spot"');
    // подпись метода в обвязке и сводка в рамке
    expect(svg).toContain("Шелкография");
    expect(svg).toContain("spot/Pantone");
    // spot-метод печатает выбранный код Pantone
    expect(svg).toContain("PMS 186 C");
  });

  it("default_method зоны применяется без явного метода нанесения", () => {
    const embView: View = {
      ...view,
      print_areas: [{ ...view.print_areas[0], default_method: "embroidery" }],
    };
    const svg = buildSceneSvg({
      sku: { ...sku, views: [embView] },
      view: embView,
      flatSvgMarkup: '<svg viewBox="0 0 600 760" width="600" height="760"></svg>',
      flatMm: { w: 600, h: 760 },
      placements: [
        {
          id: "p2",
          print_area_id: "chest",
          asset_id: "a1",
          x_mm: 200,
          y_mm: 200,
          width_mm: 80,
          height_mm: 80,
          rotation_deg: 0,
        },
      ],
      assets: {
        a1: {
          id: "a1",
          type: "png",
          source_file: "logo.png",
          data_url: "data:image/png;base64,AAAA",
          intrinsic_size_mm: { width: 80, height: 80 },
        },
      },
      meta: { client: "", orderRef: "", size: "L", date: "16.06.2026" },
    });
    expect(svg).toContain('data-method="embroidery"');
    expect(svg).toContain("Вышивка");
  });

  it("печатает допуск ± и HTM-заметку нанесения", () => {
    const svg = buildSceneSvg({
      sku,
      view,
      flatSvgMarkup: '<svg viewBox="0 0 600 760" width="600" height="760"></svg>',
      flatMm: { w: 600, h: 760 },
      placements: [
        {
          id: "p1",
          print_area_id: "chest",
          asset_id: "a1",
          x_mm: 200,
          y_mm: 200,
          width_mm: 100,
          height_mm: 100,
          rotation_deg: 0,
          method: "dtf",
          tolerance_mm: 3,
          htm: "от шва горловины",
        },
      ],
      assets: {
        a1: {
          id: "a1",
          type: "png",
          source_file: "logo.png",
          data_url: "data:image/png;base64,AAAA",
          intrinsic_size_mm: { width: 100, height: 100 },
        },
      },
      meta: { client: "", orderRef: "", size: "L", date: "16.06.2026" },
    });
    expect(svg).toContain("±3");
    expect(svg).toContain("HTM: от шва горловины");
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
