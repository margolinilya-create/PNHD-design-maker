import { describe, it, expect } from "vitest";
import { printAreaSchema, skuSchema } from "./schema";

// ── Якоря front/back по категории (одежда / аксессуары) ──

// Минимальный валидный SKU для проверки условных требований к якорям.
const mkSku = (type: string, anchors: object, extra: object = {}) => ({
  id: "x",
  name: "X",
  type,
  base_size: "M",
  sizes: ["M"],
  views: [
    {
      id: "x-front",
      kind: "front",
      flat_svg: "/x.svg",
      scale_mm_per_unit: 1,
      anchors,
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
      ...extra,
    },
  ],
});

describe("skuSchema — якоря front/back по категории", () => {
  it("одежда: front без neckline_point невалиден", () => {
    const r = skuSchema.safeParse(mkSku("tshirt", { center_axis_x: 100 }));
    expect(r.success).toBe(false);
  });

  it("аксессуар (шоппер): front без neckline_point валиден", () => {
    const r = skuSchema.safeParse(mkSku("shopper", { center_axis_x: 100 }));
    expect(r.success).toBe(true);
  });

  it("аксессуар: center_axis_x всё равно обязателен", () => {
    const r = skuSchema.safeParse(mkSku("shopper", {}));
    expect(r.success).toBe(false);
  });

  it("аксессуар: присутствующая горловина не запрещена (легаси)", () => {
    const r = skuSchema.safeParse(
      mkSku("shopper", {
        neckline_point: { x: 100, y: 50 },
        center_axis_x: 100,
      }),
    );
    expect(r.success).toBe(true);
  });

  it("аксессуар: per-size якоря без neckline_point валидны", () => {
    const r = skuSchema.safeParse(
      mkSku(
        "shopper",
        { center_axis_x: 100 },
        { size_anchors: { M: { center_axis_x: 102 } } },
      ),
    );
    expect(r.success).toBe(true);
  });

  it("одежда: per-size якоря без neckline_point невалидны", () => {
    const r = skuSchema.safeParse(
      mkSku(
        "tshirt",
        { neckline_point: { x: 100, y: 50 }, center_axis_x: 100 },
        { size_anchors: { M: { center_axis_x: 102 } } },
      ),
    );
    expect(r.success).toBe(false);
  });
});

// ── One size (аксессуары) ──

describe("skuSchema — base_size ONE SIZE", () => {
  const oneSize = (over: object = {}) => ({
    ...mkSku("shopper", { center_axis_x: 100 }),
    base_size: "ONE SIZE",
    sizes: ["ONE SIZE"],
    ...over,
  });

  it("ONE SIZE принимается как base_size", () => {
    expect(skuSchema.safeParse(oneSize()).success).toBe(true);
  });

  it("произвольная строка base_size отклоняется", () => {
    expect(
      skuSchema.safeParse(oneSize({ base_size: "XS", sizes: ["XS"] })).success,
    ).toBe(false);
  });

  it("инвариант base ∈ sizes действует и для ONE SIZE", () => {
    expect(skuSchema.safeParse(oneSize({ sizes: ["M"] })).success).toBe(false);
  });
});

// ── Допустимые методы печати зоны (PrintArea.methods) ──

const base = {
  id: "chest",
  name: "Грудь",
  polygon_mm: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ],
  safe_inset_mm: 5,
};

describe("printAreaSchema — допустимые методы зоны", () => {
  it("methods опционален и проходит roundtrip", () => {
    expect(printAreaSchema.safeParse(base).success).toBe(true);
    const withMethods = { ...base, methods: ["dtf", "screenprint"] };
    const res = printAreaSchema.safeParse(withMethods);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.methods).toEqual(["dtf", "screenprint"]);
  });

  it("неизвестный метод отклоняется", () => {
    expect(
      printAreaSchema.safeParse({ ...base, methods: ["laser"] }).success,
    ).toBe(false);
  });

  it("default_method обязан входить в methods (superRefine)", () => {
    expect(
      printAreaSchema.safeParse({
        ...base,
        default_method: "embroidery",
        methods: ["dtf"],
      }).success,
    ).toBe(false);
    // Согласованные — ок; без methods дефолт свободен.
    expect(
      printAreaSchema.safeParse({
        ...base,
        default_method: "dtf",
        methods: ["dtf"],
      }).success,
    ).toBe(true);
    expect(
      printAreaSchema.safeParse({ ...base, default_method: "embroidery" })
        .success,
    ).toBe(true);
  });
});
