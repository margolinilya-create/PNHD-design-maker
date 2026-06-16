import { describe, it, expect } from "vitest";
import {
  buildSkuFromDraft,
  validateDraft,
  zonePolygon,
  draftAnchors,
  type FlatDraft,
} from "./flatDraft";

const frontDraft: FlatDraft = {
  skuId: "test-tee",
  skuName: "Тестовая",
  type: "tshirt",
  baseSize: "M",
  viewKind: "front",
  flatDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
  scaleMmPerUnit: 1,
  neckline: { x: 300, y: 92 },
  centerAxisX: 300,
  sleeveBottomY: 0,
  sleeveCenterX: 0,
  zone: { id: "chest", name: "Грудь", x: 150, y: 140, w: 300, h: 400, safe_inset_mm: 15 },
};

describe("flatDraft", () => {
  it("zonePolygon — прямоугольник из x/y/w/h", () => {
    expect(zonePolygon(frontDraft.zone)).toEqual([
      [150, 140],
      [450, 140],
      [450, 540],
      [150, 540],
    ]);
  });

  it("draftAnchors для front — горловина + ось", () => {
    expect(draftAnchors(frontDraft)).toEqual({
      neckline_point: { x: 300, y: 92 },
      center_axis_x: 300,
    });
  });

  it("draftAnchors для рукава — низ + центр", () => {
    const a = draftAnchors({ ...frontDraft, viewKind: "sleeve_left", sleeveBottomY: 180, sleeveCenterX: 120 });
    expect(a).toEqual({ sleeve_bottom_y: 180, sleeve_center_x: 120 });
  });

  it("buildSkuFromDraft даёт валидный по схеме SKU", () => {
    expect(validateDraft(frontDraft)).toEqual([]);
    const sku = buildSkuFromDraft(frontDraft);
    expect(sku.views[0].kind).toBe("front");
    expect(sku.base_size).toBe("M");
    expect(sku.sizes).toContain("M");
  });

  it("ловит вырожденную зону", () => {
    const bad = { ...frontDraft, zone: { ...frontDraft.zone, w: 0 } };
    expect(validateDraft(bad).length).toBeGreaterThan(0);
  });
});
