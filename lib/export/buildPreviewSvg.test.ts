import { describe, it, expect } from "vitest";
import { buildPreviewSvg } from "./buildPreviewSvg";
import type { Asset, Placement, View } from "@/types";

const view = {
  kind: "front",
  anchors: {},
  print_areas: [
    {
      id: "chest", name: "Грудь",
      polygon_mm: [[100, 100], [400, 100], [400, 500], [100, 500]] as [number, number][],
      safe_inset_mm: 0,
    },
  ],
} as unknown as View;

const placement: Placement = {
  id: "p1", print_area_id: "chest", asset_id: "a",
  x_mm: 100, y_mm: 100, width_mm: 300, height_mm: 400, rotation_deg: 0,
};
const assets: Record<string, Asset> = {
  a: { id: "a", type: "png", source_file: "l.png", intrinsic_size_mm: { width: 1, height: 1 }, data_url: "data:image/png;base64,AAAA" },
};

const flatMarkup =
  '<svg viewBox="0 0 600 760" width="600" height="760"><path id="garment" d="M0 0" fill="#111"/></svg>';

describe("buildPreviewSvg — превью на флэте карточки", () => {
  it("флэт-подложка + макет в мм, клип по зоне", () => {
    const svg = buildPreviewSvg({
      view, flatSvgMarkup: flatMarkup, flatMm: { w: 600, h: 760 },
      placements: [placement], assets,
    });
    expect(svg).toContain('viewBox="0 0 600 760"'); // холст в мм флэта
    expect(svg).toContain('id="garment"'); // силуэт из карточки
    expect(svg).toMatch(/x="100"[^>]*width="300"/); // макет в мм
    expect(svg).toContain('clip-path="url(#pc-0)"'); // клип по зоне
  });

  it("перекраска флэта в цвет изделия через recolorGarment", () => {
    const svg = buildPreviewSvg({
      view, flatSvgMarkup: flatMarkup, flatMm: { w: 600, h: 760 },
      garmentColor: "#3b4a6b", placements: [], assets: {},
    });
    expect(svg).toContain('fill="#3b4a6b"');
  });

  it("растровый флэт рисуется <image> вместо inner-SVG", () => {
    const svg = buildPreviewSvg({
      view, flatSvgMarkup: "", flatRasterUrl: "data:image/png;base64,RRRR",
      flatMm: { w: 600, h: 760 }, placements: [], assets: {},
    });
    expect(svg).toMatch(/<image href="data:image\/png;base64,RRRR"/);
  });

  it("скрытые нанесения не попадают в превью", () => {
    const svg = buildPreviewSvg({
      view, flatSvgMarkup: flatMarkup, flatMm: { w: 600, h: 760 },
      placements: [{ ...placement, hidden: true }], assets,
    });
    expect(svg).not.toContain("data:image/png;base64,AAAA");
  });
});
