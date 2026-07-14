// Парсер физического размера SVG-макета (баг-аудит 2026-07: viewBox-only
// раньше считался достоверными мм и не помечался оценкой).
import { describe, it, expect } from "vitest";
import { parseSvgSizeMm } from "./loadAsset";

describe("parseSvgSizeMm", () => {
  it("width/height в мм — достоверный размер", () => {
    const r = parseSvgSizeMm('<svg width="210mm" height="297mm"></svg>');
    expect(r).toEqual({ w: 210, h: 297, estimated: false });
  });

  it("width/height в cm/pt — достоверный размер с пересчётом", () => {
    const r = parseSvgSizeMm('<svg width="21cm" height="720pt"></svg>');
    expect(r?.w).toBeCloseTo(210, 3);
    expect(r?.h).toBeCloseTo(254.0, 1);
    expect(r?.estimated).toBe(false);
  });

  it("width/height с единицами приоритетнее viewBox", () => {
    const r = parseSvgSizeMm(
      '<svg width="100mm" height="50mm" viewBox="0 0 600 300"></svg>',
    );
    expect(r).toEqual({ w: 100, h: 50, estimated: false });
  });

  it("unitless width/height = px → пересчёт 96dpi, но ОЦЕНКА", () => {
    const r = parseSvgSizeMm('<svg width="600" height="300"></svg>');
    expect(r?.w).toBeCloseTo(600 * 0.2645833, 3);
    expect(r?.estimated).toBe(true);
  });

  it("viewBox-only → 1 unit = 1 мм, но помечен оценкой", () => {
    const r = parseSvgSizeMm('<svg viewBox="0 0 600 760"></svg>');
    expect(r).toEqual({ w: 600, h: 760, estimated: true });
  });

  it("нет метрик вообще → null", () => {
    expect(parseSvgSizeMm("<svg><rect/></svg>")).toBeNull();
    expect(parseSvgSizeMm('<svg width="100%" height="100%"></svg>')).toBeNull();
  });
});
