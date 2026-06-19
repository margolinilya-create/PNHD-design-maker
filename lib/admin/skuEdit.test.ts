import { describe, it, expect } from "vitest";
import {
  cloneSku,
  validateSku,
  addSize,
  removeSize,
  addView,
  removeView,
  addZone,
  removeZone,
  updateZone,
  rectZone,
  zoneRect,
  emptySku,
} from "./skuEdit";
import type { SKU } from "@/types";

const sku: SKU = {
  id: "tee",
  name: "Футболка",
  type: "tshirt",
  base_size: "M",
  sizes: ["M", "L"],
  views: [
    {
      id: "v-front",
      kind: "front",
      flat_svg: "x.svg",
      scale_mm_per_unit: 1,
      anchors: { neckline_point: { x: 150, y: 30 }, center_axis_x: 150 },
      print_areas: [rectZone("chest", "Грудь", 40, 60, 220, 280, 10)],
    },
  ],
};

describe("skuEdit", () => {
  it("cloneSku — глубокая копия с новым id/именем", () => {
    const c = cloneSku(sku, "tee-2", "Копия");
    expect(c.id).toBe("tee-2");
    expect(c.name).toBe("Копия");
    c.views[0].kind = "back";
    expect(sku.views[0].kind).toBe("front"); // оригинал не задет
  });

  it("validateSku — валидный SKU без ошибок", () => {
    expect(validateSku(sku)).toEqual([]);
  });

  it("addSize/removeSize; базовый размер не удаляется", () => {
    const a = addSize(sku, "XL");
    expect(a.sizes).toContain("XL");
    expect(addSize(a, "XL").sizes.filter((s) => s === "XL")).toHaveLength(1);
    expect(removeSize(a, "M").sizes).toContain("M"); // базовый цел
    expect(removeSize(a, "L").sizes).not.toContain("L");
  });

  it("addView/removeView; минимум один вид", () => {
    const a = addView(sku, "back");
    expect(a.views).toHaveLength(2);
    const r = removeView(a, a.views[1].id);
    expect(r.views).toHaveLength(1);
    expect(removeView(r, r.views[0].id).views).toHaveLength(1); // не удалить последний
  });

  it("addZone/removeZone; минимум одна зона", () => {
    const a = addZone(sku, "v-front");
    expect(a.views[0].print_areas).toHaveLength(2);
    const r = removeZone(a, "v-front", a.views[0].print_areas[1].id);
    expect(r.views[0].print_areas).toHaveLength(1);
    expect(removeZone(r, "v-front", "chest").views[0].print_areas).toHaveLength(1);
  });

  it("updateZone меняет поля зоны", () => {
    const a = updateZone(sku, "v-front", "chest", {
      name: "Центр",
      default_method: "screenprint",
    });
    expect(a.views[0].print_areas[0].name).toBe("Центр");
    expect(a.views[0].print_areas[0].default_method).toBe("screenprint");
  });

  it("zoneRect ↔ rectZone round-trip", () => {
    const z = rectZone("z", "z", 10, 20, 100, 80);
    expect(zoneRect(z)).toEqual({ x: 10, y: 20, w: 100, h: 80 });
  });

  it("emptySku валиден по схеме", () => {
    expect(validateSku(emptySku("new", "Новая", "tshirt"))).toEqual([]);
  });
});
