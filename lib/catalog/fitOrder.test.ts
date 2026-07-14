import { describe, it, expect } from "vitest";
import { fitRank, sortSkusByFit } from "./fitOrder";

describe("fitOrder — посадки от меньшей к большей", () => {
  it("Classic → Regular → FreeFit → Oversize → OversizeCrop", () => {
    const names = [
      "Футболка OversizeCrop",
      "Футболка Regular",
      "Футболка Oversize",
      "Футболка Classic",
      "Футболка FreeFit (oversized)",
    ];
    const sorted = sortSkusByFit(names.map((name) => ({ name })));
    expect(sorted.map((s) => s.name)).toEqual([
      "Футболка Classic",
      "Футболка Regular",
      "Футболка FreeFit (oversized)",
      "Футболка Oversize",
      "Футболка OversizeCrop",
    ]);
  });

  it("«FreeFit (oversized)» — это фри, не оверсайз", () => {
    expect(fitRank("Футболка FreeFit (oversized)")).toBe(2);
  });

  it("неизвестные посадки — в конец по алфавиту (Reglan ≠ Regular)", () => {
    const sorted = sortSkusByFit(
      ["Худи Reglan", "Худи Oversize", "Худи Classic"].map((name) => ({ name })),
    );
    expect(sorted.map((s) => s.name)).toEqual([
      "Худи Classic",
      "Худи Oversize",
      "Худи Reglan",
    ]);
    const shoppers = sortSkusByFit(
      ["Шоппер Horizontal", "Шоппер Composite", "Шоппер Classic"].map(
        (name) => ({ name }),
      ),
    );
    expect(shoppers.map((s) => s.name)).toEqual([
      "Шоппер Classic",
      "Шоппер Composite",
      "Шоппер Horizontal",
    ]);
  });
});
