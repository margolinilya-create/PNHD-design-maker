import { describe, it, expect } from "vitest";
import {
  printToPxRect,
  pxRectToPrint,
  zoneAspectFromBbox,
} from "./mockupGeom";

describe("mockupGeom", () => {
  it("printToPxRect: доли фото → пиксели, высота по аспекту зоны", () => {
    // фото 1000×1200, зона аспект 400/300 = 1.333
    const r = printToPxRect({ x: 0.3, y: 0.25, w: 0.4 }, 1000, 1200, 400 / 300);
    expect(r.x).toBe(300);
    expect(r.y).toBe(300);
    expect(r.w).toBe(400);
    expect(r.h).toBeCloseTo(400 * (400 / 300), 5); // ширина × аспект
  });

  it("pxRectToPrint обратно в доли (round-trip)", () => {
    const p = { x: 0.3, y: 0.25, w: 0.4 };
    const r = printToPxRect(p, 1000, 1200, 1.2);
    const back = pxRectToPrint(r, 1000, 1200);
    expect(back.x).toBeCloseTo(p.x, 6);
    expect(back.y).toBeCloseTo(p.y, 6);
    expect(back.w).toBeCloseTo(p.w, 6);
  });

  it("zoneAspectFromBbox = zh/zw, защита от нуля", () => {
    expect(zoneAspectFromBbox(300, 400)).toBeCloseTo(1.333, 3);
    expect(zoneAspectFromBbox(0, 400)).toBe(1);
  });
});
