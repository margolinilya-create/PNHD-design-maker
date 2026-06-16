import { describe, it, expect } from "vitest";
import { effectiveDpi, printQuality } from "./dpi";
import type { Asset } from "@/types";

const png = (px: number): Asset => ({
  id: "a",
  type: "png",
  source_file: "logo.png",
  intrinsic_size_mm: { width: 100, height: 100 },
  px_width: px,
  px_height: px,
});

describe("effectiveDpi", () => {
  it("пиксели на ширину печати в дюймах", () => {
    // 1181 px на 100 мм (≈3.937 дюйма) ≈ 300 DPI.
    expect(effectiveDpi(1181, 100)).toBeCloseTo(300, 0);
  });
  it("нулевые входы → 0", () => {
    expect(effectiveDpi(0, 100)).toBe(0);
    expect(effectiveDpi(1000, 0)).toBe(0);
  });
});

describe("printQuality", () => {
  it("SVG — всегда вектор", () => {
    const svg: Asset = {
      id: "s",
      type: "svg",
      source_file: "l.svg",
      intrinsic_size_mm: { width: 50, height: 50 },
    };
    expect(printQuality(svg, 500).quality).toBe("vector");
  });
  it("good при ≥300 DPI", () => {
    expect(printQuality(png(1200), 100).quality).toBe("good");
  });
  it("mid при 150–299 DPI", () => {
    // 800px/100мм ≈ 203 DPI.
    expect(printQuality(png(800), 100).quality).toBe("mid");
  });
  it("low при <150 DPI", () => {
    // 400px/100мм ≈ 102 DPI.
    expect(printQuality(png(400), 100).quality).toBe("low");
  });
  it("без px_width — unknown", () => {
    const a: Asset = {
      id: "x",
      type: "png",
      source_file: "x.png",
      intrinsic_size_mm: { width: 100, height: 100 },
    };
    expect(printQuality(a, 100).quality).toBe("unknown");
  });
});
