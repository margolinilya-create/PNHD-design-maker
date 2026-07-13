import { describe, it, expect } from "vitest";
import { mergeCatalog, overrideDiffersFromSeed } from "./mergedCatalog";
import type { SKU } from "@/types";

const mkSku = (id: string, name = id, extra: Partial<SKU> = {}): SKU => ({
  id,
  name,
  type: "tshirt",
  product_kind: "finished",
  base_size: "M",
  sizes: ["M"],
  views: [
    {
      id: `${id}-front`,
      kind: "front",
      flat_svg: "/x.svg",
      scale_mm_per_unit: 1,
      anchors: { neckline_point: { x: 100, y: 50 }, center_axis_x: 100 },
      print_areas: [
        {
          id: "front",
          name: "Перёд",
          polygon_mm: [
            [50, 100],
            [150, 100],
            [150, 200],
            [50, 200],
          ],
          safe_inset_mm: 10,
        },
      ],
    },
  ],
  ...extra,
});

describe("mergeCatalog — override-семантика", () => {
  const seed = [mkSku("a"), mkSku("b"), mkSku("c")];

  it("модель с seed-id перекрывает seed НА МЕСТЕ, порядок сохранён", () => {
    const override = mkSku("b", "B изменённая");
    const m = mergeCatalog(seed, [override]);
    expect(m.skus.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(m.skus[1].name).toBe("B изменённая");
    expect(m.overriddenIds).toEqual(new Set(["b"]));
    expect(m.customIds.size).toBe(0);
  });

  it("модель с собственным id добавляется в конец (custom)", () => {
    const custom = mkSku("z");
    const m = mergeCatalog(seed, [custom]);
    expect(m.skus.map((s) => s.id)).toEqual(["a", "b", "c", "z"]);
    expect(m.customIds).toEqual(new Set(["z"]));
    expect(m.overriddenIds.size).toBe(0);
  });

  it("seedIds/rawModels заполняются; rawModels отдаёт сырую строку", () => {
    const override = mkSku("a", "A правка");
    const m = mergeCatalog(seed, [override, mkSku("z")]);
    expect(m.seedIds).toEqual(new Set(["a", "b", "c"]));
    expect(m.rawModels.get("a")?.name).toBe("A правка");
    expect(m.rawModels.get("z")).toBeDefined();
  });

  it("grade_rule модели разворачивается в size_anchors", () => {
    const withRule = mkSku("z", "с правилом", {
      sizes: ["S", "M", "L"],
      views: [
        {
          ...mkSku("z").views[0],
          grade_rule: { neckline: { dx: 0, dy: 5 } },
        },
      ],
    });
    const m = mergeCatalog(seed, [withRule]);
    const v = m.skus.find((s) => s.id === "z")!.views[0];
    expect(v.size_anchors?.L?.neckline_point?.y).toBe(55); // 50 + 5×1 шаг
    expect(v.size_anchors?.S?.neckline_point?.y).toBe(45);
  });

  it("hidden-модели merge НЕ фильтрует (фильтруют потребители)", () => {
    const hidden = mkSku("b", "скрытая", { hidden: true } as Partial<SKU>);
    const m = mergeCatalog(seed, [hidden]);
    expect(m.skus.find((s) => s.id === "b")).toBeDefined();
  });

  it("повторный merge результата идемпотентен по составу id", () => {
    const m1 = mergeCatalog(seed, [mkSku("b", "B2"), mkSku("z")]);
    const m2 = mergeCatalog(m1.skus, []);
    expect(m2.skus.map((s) => s.id)).toEqual(m1.skus.map((s) => s.id));
  });
});

describe("overrideDiffersFromSeed", () => {
  const seed = mkSku("a");

  it("идентичный override (кроме hidden) — не «изменена»", () => {
    const hiddenOnly = { ...mkSku("a"), hidden: true } as SKU;
    expect(overrideDiffersFromSeed(seed, hiddenOnly)).toBe(false);
  });

  it("правка имени — «изменена»", () => {
    expect(overrideDiffersFromSeed(seed, mkSku("a", "другое имя"))).toBe(true);
  });
});
