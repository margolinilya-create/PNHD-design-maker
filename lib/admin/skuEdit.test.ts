import { describe, it, expect } from "vitest";
import {
  cloneSku,
  validateSku,
  idError,
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
  effAnchors,
  effZones,
  setSizeAnchors,
  updateSizeZoneRect,
  clearSizeOverride,
  clearSizeAnchors,
  clearSizeZones,
  moveView,
  moveZone,
  duplicateView,
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

  it("moveView переставляет виды; no-op на краях", () => {
    const two = addView(sku, "back");
    const ids = two.views.map((v) => v.id);
    const up = moveView(two, ids[1], -1);
    expect(up.views.map((v) => v.id)).toEqual([ids[1], ids[0]]);
    expect(moveView(two, ids[0], -1)).toBe(two); // край — без изменений
    expect(moveView(two, ids[1], 1)).toBe(two);
  });

  it("moveZone двигает зону в базе и во всех per-size наборах", () => {
    let s = addZone(sku, "v-front"); // chest + zone-2
    const zid = s.views[0].print_areas[1].id;
    // per-size набор для L с тем же порядком
    s = {
      ...s,
      views: [
        {
          ...s.views[0],
          size_print_areas: { L: s.views[0].print_areas.map((a) => ({ ...a })) },
        },
      ],
    };
    const moved = moveZone(s, "v-front", zid, -1);
    expect(moved.views[0].print_areas[0].id).toBe(zid);
    expect(moved.views[0].size_print_areas?.L[0].id).toBe(zid);
    expect(moveZone(moved, "v-front", zid, -1)).toBe(moved); // край
  });

  it("duplicateView: копия рядом, новые уникальные id вида и зон, ремап per-size", () => {
    let s = addZone(sku, "v-front");
    s = {
      ...s,
      views: [
        {
          ...s.views[0],
          size_print_areas: { L: s.views[0].print_areas.map((a) => ({ ...a })) },
        },
      ],
    };
    const d = duplicateView(s, "v-front");
    expect(d.views).toHaveLength(2);
    const [orig, copy] = d.views;
    expect(copy.id).not.toBe(orig.id);
    const allZoneIds = d.views.flatMap((v) => v.print_areas.map((a) => a.id));
    expect(new Set(allZoneIds).size).toBe(allZoneIds.length); // уникальны в SKU
    // per-size ремапнут на новые id
    const copySizeIds = copy.size_print_areas!.L.map((a) => a.id);
    expect(copySizeIds).toEqual(copy.print_areas.map((a) => a.id));
    // изоляция: правка копии не трогает оригинал
    copy.print_areas[0].polygon_mm[0][0] = 999;
    expect(orig.print_areas[0].polygon_mm[0][0]).not.toBe(999);
    expect(validateSku(d)).toEqual([]);
  });

  it("validateSku принимает лимиты печати min/max", () => {
    const withLimits = updateZone(sku, "v-front", "chest", {
      max_print_mm: { width: 300, height: 400 },
      min_print_mm: { width: 50, height: 50 },
    });
    expect(validateSku(withLimits)).toEqual([]);
  });

  it("emptySku валиден по схеме", () => {
    expect(validateSku(emptySku("new", "Новая", "tshirt"))).toEqual([]);
  });

  it("emptySku — готовое изделие по умолчанию", () => {
    expect(emptySku("new", "Новая", "tshirt").product_kind).toBe("finished");
  });

  it("именованные оси (axes) проходят валидацию схемы", () => {
    const s = emptySku("ax", "С осями", "tshirt");
    s.views[0].anchors.axes = [{ id: "dart-l", name: "выточка Л", x: 120 }];
    expect(validateSku(s)).toEqual([]);
  });

  it("per-size: override якорей/зон, фоллбэк на базовые, валидность", () => {
    // базовый размер — фоллбэк на базовые
    expect(effAnchors(sku.views[0], "M", "M").neckline_point?.y).toBe(30);
    expect(effAnchors(sku.views[0], "L", "M").neckline_point?.y).toBe(30); // нет override → базовые

    // override якорей на L
    const a = setSizeAnchors(sku, "v-front", "L", "M", {
      neckline_point: { x: 150, y: 44 },
      center_axis_x: 150,
    });
    expect(effAnchors(a.views[0], "L", "M").neckline_point?.y).toBe(44);
    expect(effAnchors(a.views[0], "M", "M").neckline_point?.y).toBe(30); // базовый не тронут
    expect(validateSku(a)).toEqual([]);

    // override прямоугольника зоны на L (copy-on-write всех зон)
    const b = updateSizeZoneRect(a, "v-front", "L", "M", "chest", {
      x: 50,
      y: 70,
      w: 240,
      h: 300,
    });
    expect(zoneRect(effZones(b.views[0], "L", "M")[0])).toEqual({
      x: 50,
      y: 70,
      w: 240,
      h: 300,
    });
    expect(zoneRect(effZones(b.views[0], "M", "M")[0]).w).toBe(220); // базовый цел
    expect(validateSku(b)).toEqual([]);

    // сброс override → снова базовые
    const c = clearSizeOverride(b, "v-front", "L");
    expect(effAnchors(c.views[0], "L", "M").neckline_point?.y).toBe(30);
    expect(c.views[0].size_print_areas).toBeUndefined();

    // гранулярный сброс: только зоны — якоря остаются
    const d = clearSizeZones(b, "v-front", "L");
    expect(d.views[0].size_print_areas).toBeUndefined();
    expect(effAnchors(d.views[0], "L", "M").neckline_point?.y).toBe(44); // якоря целы
    // только якоря — зоны остаются
    const e = clearSizeAnchors(b, "v-front", "L");
    expect(e.views[0].size_anchors).toBeUndefined();
    expect(zoneRect(effZones(e.views[0], "L", "M")[0]).w).toBe(240); // зоны целы
  });

  it("idError — формат и коллизии", () => {
    expect(idError("tee-1", ["seed-a"])).toBeNull();
    expect(idError("", [])).toBeTruthy();
    expect(idError("Tee 1", [])).toBeTruthy(); // пробел/регистр
    expect(idError("tshirt-classic", ["tshirt-classic"])).toBeTruthy(); // занят
  });
});
