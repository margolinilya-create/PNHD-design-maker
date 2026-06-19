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

// Раскладка листа (мм): PAD 14, GAP 16, SPEC_W 150, TITLE_H 42, FOOTER_H 22.
// Для флэта 600×760 (full): W = 14+600+16+150+14 = 794; H = 54+760+22+14 = 850.

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

const pngAsset = {
  a1: {
    id: "a1",
    type: "png" as const,
    source_file: "logo.png",
    data_url: "data:image/png;base64,AAAA",
    intrinsic_size_mm: { width: 100, height: 100 },
  },
};

describe("buildSceneSvg — тех-лист «Студия»", () => {
  it("страница в мм (1:1): рисунок 1:1 + панель спецификации", () => {
    const svg = scene();
    expect(svg).toMatch(/width="794mm"/);
    expect(svg).toMatch(/height="850mm"/);
    expect(svg).toMatch(/viewBox="0 0 794 850"/);
  });

  it("scale_mm_per_unit масштабирует флэт, страница остаётся в мм", () => {
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
    expect(svg).toContain('transform="scale(0.5)"');
    expect(svg).toMatch(/width="694mm"/); // 14+500+16+150+14
    expect(svg).toMatch(/height="690mm"/); // 42+600+22+14
  });

  it("слои: garment / zones / production-artwork / markup", () => {
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
        },
      ],
      assets: pngAsset,
      meta: { client: "", orderRef: "", size: "L", date: "16.06.2026" },
    });
    expect(svg).toContain('data-layer="garment"');
    expect(svg).toContain('data-layer="zones"');
    expect(svg).toContain('data-layer="production-artwork"');
    expect(svg).toContain('data-layer="markup"');
  });

  it("спецификация: метод/режим цвета/Pantone для шелкографии", () => {
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
      assets: pngAsset,
      meta: { client: "", orderRef: "", size: "L", date: "16.06.2026" },
    });
    expect(svg).toContain('data-method="screenprint"');
    expect(svg).toContain('data-color-mode="spot"');
    expect(svg).toContain("Шелкография");
    expect(svg).toContain("spot/Pantone");
    expect(svg).toContain("PMS 186 C");
    expect(svg).toContain('data-spec="1"');
  });

  it("default_method зоны применяется без явного метода", () => {
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
      assets: pngAsset,
      meta: { client: "", orderRef: "", size: "L", date: "16.06.2026" },
    });
    expect(svg).toContain('data-method="embroidery"');
    expect(svg).toContain("Вышивка");
  });

  it("печатает допуск ± и HTM-заметку в спецификации", () => {
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
      assets: pngAsset,
      meta: { client: "", orderRef: "", size: "L", date: "16.06.2026" },
    });
    expect(svg).toContain("±3");
    expect(svg).toContain("от шва горловины");
  });

  it("легенда конвенций линий присутствует", () => {
    const svg = scene();
    expect(svg).toContain('data-legend="1"');
    expect(svg).toContain("Размерная линия (мм)");
  });

  it("production-вариант: без обвязки/спецификации, с пометкой для цеха", () => {
    const common = {
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
          method: "dtf" as const,
        },
      ],
      assets: pngAsset,
      meta: { client: "", orderRef: "", size: "L", date: "16.06.2026" },
    };
    const prod = buildSceneSvg({ ...common, variant: "production" });
    expect(prod).not.toContain('data-legend="1"');
    expect(prod).not.toContain('data-spec="1"');
    expect(prod).toContain("ЛИСТ ДЛЯ ЦЕХА");
    expect(prod).toContain('data-layer="production-artwork"');
  });

  it("калибровочная шкала ровно 100 мм", () => {
    const svg = scene();
    expect(svg).toContain('data-calibration-mm="100"');
    const m = svg.match(
      /<line x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)" y2="[\d.]+" stroke="#4b5563" stroke-width="0\.75"\/>/,
    );
    expect(m).not.toBeNull();
    expect(parseFloat(m![2]) - parseFloat(m![1])).toBeCloseTo(100, 6);
  });
});
