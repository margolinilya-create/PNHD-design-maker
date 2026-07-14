import { describe, it, expect } from "vitest";
import {
  GARMENT_TYPE_CATEGORY,
  GARMENT_TYPE_LABELS,
  PRODUCT_CATEGORY_LABELS,
  isAccessoryType,
  skuCategory,
} from "@/types";
import type { GarmentType } from "@/types";

describe("категории товаров (одежда / аксессуары)", () => {
  it("карта категорий покрывает все типы изделий", () => {
    const types = Object.keys(GARMENT_TYPE_LABELS) as GarmentType[];
    for (const t of types) {
      expect(GARMENT_TYPE_CATEGORY[t], `нет категории для "${t}"`).toBeDefined();
    }
    expect(Object.keys(GARMENT_TYPE_CATEGORY).sort()).toEqual(
      Object.keys(GARMENT_TYPE_LABELS).sort(),
    );
  });

  it("шоппер — аксессуар, остальные — одежда", () => {
    expect(GARMENT_TYPE_CATEGORY.shopper).toBe("accessory");
    const clothing = (Object.keys(GARMENT_TYPE_CATEGORY) as GarmentType[]).filter(
      (t) => t !== "shopper",
    );
    for (const t of clothing) expect(GARMENT_TYPE_CATEGORY[t]).toBe("clothing");
  });

  it("isAccessoryType / skuCategory согласованы с картой", () => {
    expect(isAccessoryType("shopper")).toBe(true);
    expect(isAccessoryType("tshirt")).toBe(false);
    expect(skuCategory({ type: "shopper" })).toBe("accessory");
    expect(skuCategory({ type: "hoodie" })).toBe("clothing");
  });

  it("у обеих категорий есть русские подписи", () => {
    expect(PRODUCT_CATEGORY_LABELS.clothing).toBe("Одежда");
    expect(PRODUCT_CATEGORY_LABELS.accessory).toBe("Аксессуары");
  });
});
