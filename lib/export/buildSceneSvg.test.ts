import { describe, it, expect } from "vitest";
import { buildSceneSvg, PDF_FONT_FAMILY } from "./buildSceneSvg";
import type { Placement, SKU, View } from "@/types";

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

const pngAsset = {
  a1: {
    id: "a1",
    type: "png" as const,
    source_file: "logo.png",
    data_url: "data:image/png;base64,AAAA",
    intrinsic_size_mm: { width: 100, height: 100 },
  },
};

const basePlacement = (over: Partial<Placement> = {}): Placement => ({
  id: "p1",
  print_area_id: "chest",
  asset_id: "a1",
  x_mm: 250,
  y_mm: 167, // отступ от горловины 92 → 75 мм
  width_mm: 100,
  height_mm: 100,
  rotation_deg: 0,
  method: "dtf",
  ...over,
});

// Раскладка листа (мм): PAD 14, HEADER_H 26, SIZE_H 42.
// Для флэта 600×760: W = 14+600+14 = 628; H = 26+760+42+14 = 842.
function scene(over: Partial<Parameters<typeof buildSceneSvg>[0]> = {}) {
  return buildSceneSvg({
    sku,
    view,
    flatSvgMarkup: '<svg viewBox="0 0 600 760" width="600" height="760"></svg>',
    flatMm: { w: 600, h: 760 },
    placements: [basePlacement()],
    assets: pngAsset,
    meta: { client: "К", orderRef: "З-1", size: "M", date: "13.07.2026" },
    ...over,
  });
}

describe("buildSceneSvg — минимальный тех-лист", () => {
  it("страница в мм (1:1): шапка + рисунок + блок размера", () => {
    const svg = scene();
    expect(svg).toMatch(/width="628mm"/);
    expect(svg).toMatch(/height="842mm"/);
    expect(svg).toMatch(/viewBox="0 0 628 842"/);
  });

  it("scale_mm_per_unit масштабирует флэт, страница остаётся в мм", () => {
    const svg = scene({
      flatSvgMarkup:
        '<svg viewBox="0 0 1000 1200" width="1000" height="1200"><path id="garment" d="M0 0"/></svg>',
      flatMm: { w: 500, h: 600 },
      scaleMmPerUnit: 0.5,
      placements: [],
      assets: {},
    });
    expect(svg).toContain('transform="scale(0.5)"');
    expect(svg).toMatch(/width="528mm"/); // 14+500+14
    expect(svg).toMatch(/height="682mm"/); // 26+600+42+14
  });

  it("шапка заказа: клиент, № заказа, дата, статус-чип", () => {
    const svg = scene();
    expect(svg).toContain('data-order-header="1"');
    expect(svg).toContain("Клиент: К · Заказ №: З-1 · 13.07.2026");
    expect(svg).toContain("Черновик");
    const approved = scene({
      meta: {
        client: "К",
        orderRef: "З-1",
        size: "M",
        date: "13.07.2026",
        status: "approved",
      },
    });
    expect(approved).toContain("Согласовано");
  });

  it("пустые клиент/заказ печатаются прочерками", () => {
    const svg = scene({
      meta: { client: "", orderRef: "", size: "M", date: "13.07.2026" },
    });
    expect(svg).toContain("Клиент: — · Заказ №: — · 13.07.2026");
  });

  it("слои: garment / production-artwork / markup, метод и режим цвета", () => {
    const svg = scene({
      placements: [basePlacement({ method: "screenprint" })],
    });
    expect(svg).toContain('data-layer="garment"');
    expect(svg).toContain('data-layer="production-artwork"');
    expect(svg).toContain('data-layer="markup"');
    expect(svg).toContain('data-method="screenprint"');
    expect(svg).toContain('data-color-mode="spot"');
  });

  it("default_method зоны применяется без явного метода", () => {
    const embView: View = {
      ...view,
      print_areas: [{ ...view.print_areas[0], default_method: "embroidery" }],
    };
    const svg = scene({
      sku: { ...sku, views: [embView] },
      view: embView,
      placements: [basePlacement({ method: undefined })],
    });
    expect(svg).toContain('data-method="embroidery"');
  });

  it("минимализм: без спеки/легенды/зон/краевых стрелок/футера цеха", () => {
    const svg = scene();
    expect(svg).not.toContain('data-spec="1"');
    expect(svg).not.toContain('data-legend="1"');
    expect(svg).not.toContain('data-layer="zones"');
    expect(svg).not.toContain("marker-start");
    expect(svg).not.toContain("Согласовано (цех)");
  });

  it("на нанесение — отступ от горловины (с допуском) и плашка Ш×В", () => {
    const svg = scene({
      placements: [basePlacement({ tolerance_mm: 3 })],
    });
    expect(svg).toContain(">75 ±3<"); // отступ от горловины, мм
    expect(svg).toContain("100×100 mm"); // размер макета (latin-safe)
  });

  it("метка размера: буква — кегль 34, ONE SIZE — 20", () => {
    const m = scene();
    expect(m).toContain('data-size-label="M"');
    expect(m).toMatch(/font-size="34"[^>]*>M<\/text>/);
    const one = scene({
      meta: { client: "", orderRef: "", size: "ONE SIZE", date: "13.07.2026" },
    });
    expect(one).toContain('data-size-label="ONE SIZE"');
    expect(one).toMatch(/font-size="20"[^>]*>ONE SIZE<\/text>/);
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

  it("шрифт листа — кириллический (PDF_FONT_FAMILY на корне)", () => {
    expect(scene()).toContain(`font-family="${PDF_FONT_FAMILY}`);
  });

  it("растровый флэт (PDF/AI-визуалка) рисуется <image> в garment-слое", () => {
    const svg = scene({
      flatSvgMarkup: "",
      flatRaster: { dataUrl: "data:image/png;base64,FLAT" },
      placements: [],
      assets: {},
    });
    const garment = svg.match(/<g data-layer="garment">([\s\S]*?)<\/g>/)![1];
    expect(garment).toContain("<image");
    expect(garment).toContain('width="600"');
    expect(garment).toContain('height="760"');
    expect(svg).toMatch(/width="628mm"/); // страница по-прежнему в мм
  });

  it("аксессуар без горловины: панельный якорь, лист собирается", () => {
    const shopperView: View = { ...view, anchors: { center_axis_x: 300 } };
    const svg = scene({
      sku: {
        ...sku,
        id: "shopper",
        name: "Шоппер",
        type: "shopper",
        views: [shopperView],
      },
      view: shopperView,
    });
    // Отступ меряется от верха зоны (140): y=167 → 27 мм.
    expect(svg).toContain(">27<");
  });
});
