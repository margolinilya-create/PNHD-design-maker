import { describe, it, expect } from "vitest";
import { luminance, isLightPixel } from "./autoMask";

describe("autoMask predicate", () => {
  it("luminance по Rec.601", () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(255, 5);
    expect(luminance(0, 0, 0)).toBe(0);
    expect(luminance(255, 0, 0)).toBeCloseTo(76.245, 2);
  });
  it("isLightPixel относительно порога", () => {
    expect(isLightPixel(255, 255, 255, 150)).toBe(true); // белый — ткань
    expect(isLightPixel(20, 20, 20, 150)).toBe(false); // тёмный фон — нет
    expect(isLightPixel(150, 150, 150, 150)).toBe(true); // ровно порог
  });
});
