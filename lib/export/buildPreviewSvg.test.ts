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

describe("buildPreviewSvg — фото-мокап", () => {
  it("макет, покрывающий зону, ложится в печатный прямоугольник на фото", () => {
    const svg = buildPreviewSvg({
      view, flatSvgMarkup: "", flatMm: { w: 0, h: 0 },
      placements: [placement], assets,
      mockup: { dataUrl: "data:image/jpeg;base64,BBBB", imgW: 1000, imgH: 1000, print: { x: 0.3, y: 0.25, w: 0.3 } },
    });
    // scale = 0.3*1000/300 = 1 px/мм; ox = 0.3*1000 = 300 → image x=300, width=300.
    expect(svg).toContain('width="1000" height="1000"'); // размер по фото
    expect(svg).toMatch(/<image href="data:image\/jpeg/); // фото-подложка
    expect(svg).toMatch(/x="300"[^>]*width="300"/); // макет в зоне
    expect(svg).toContain('clip-path="url(#mk-0)"'); // клип по зоне
  });

  it("перекраска фото: цвет multiply по маске ткани (только при цвете+маске)", () => {
    const base = {
      view,
      flatSvgMarkup: "",
      flatMm: { w: 0, h: 0 },
      placements: [placement],
      assets,
    };
    const mk = {
      dataUrl: "data:image/jpeg;base64,BBBB",
      imgW: 1000,
      imgH: 1000,
      print: { x: 0.3, y: 0.25, w: 0.3 },
      maskDataUrl: "data:image/png;base64,MMMM",
    };
    // цвет + маска → тинт multiply по маске
    const tinted = buildPreviewSvg({ ...base, garmentColor: "#3b4a6b", mockup: mk });
    expect(tinted).toContain("mix-blend-mode:multiply");
    expect(tinted).toContain('fill="#3b4a6b"');
    expect(tinted).toContain('mask="url(#garment-mask)"');
    expect(tinted).toMatch(/<mask id="garment-mask"/);

    // нет цвета → нет тинта
    const noColor = buildPreviewSvg({ ...base, garmentColor: "", mockup: mk });
    expect(noColor).not.toContain("mix-blend-mode");

    // есть цвет, но нет маски → нет тинта (без маски не перекрашиваем)
    const noMask = buildPreviewSvg({
      ...base,
      garmentColor: "#3b4a6b",
      mockup: { ...mk, maskDataUrl: undefined },
    });
    expect(noMask).not.toContain("mix-blend-mode");
  });

  it("без мокапа — чистый флэт-превью (виден силуэт, нет фото)", () => {
    const svg = buildPreviewSvg({
      view, flatSvgMarkup: '<svg viewBox="0 0 600 760" width="600" height="760"><path id="garment" d="M0 0" fill="#111"/></svg>',
      flatMm: { w: 600, h: 760 }, placements: [], assets: {},
    });
    expect(svg).toContain('id="garment"');
    expect(svg).not.toContain("mix-blend-mode");
  });
});
