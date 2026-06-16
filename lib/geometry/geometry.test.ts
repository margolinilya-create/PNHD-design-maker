import { describe, it, expect } from "vitest";
import { polygonToZone, rotatedAabb, type Bbox } from "./coords";
import {
  verticalFromNeckline,
  horizontalFromCenter,
  verticalFromBottom,
  fullDimensions,
} from "./dimension";
import { checkZone } from "./zone";
import {
  captureInvariant,
  applyInvariantFrontBack,
  captureSleeveInvariant,
  applyInvariantSleeve,
} from "./grading";
import {
  placementInfo,
  regradePosition,
  anchorsForSize,
  viewZone,
} from "./view";

// Эталон из seed: перед tshirt-classic.
const NECKLINE_Y = 92;
const CENTER_X = 300;
const CHEST_ZONE = polygonToZone([
  [150, 140],
  [450, 140],
  [450, 540],
  [150, 540],
]);

describe("dimension", () => {
  it("vertical_from_neckline = bbox.y − neckline.y", () => {
    const bbox: Bbox = { x: 225, y: 150, w: 150, h: 200 };
    expect(verticalFromNeckline(bbox, NECKLINE_Y)).toBe(58);
  });

  it("horizontal_from_center = 0 для центрированного макета", () => {
    const bbox: Bbox = { x: 225, y: 150, w: 150, h: 200 };
    expect(horizontalFromCenter(bbox, CENTER_X)).toBe(0);
  });

  it("horizontal_from_center положителен при сдвиге вправо", () => {
    const bbox: Bbox = { x: 245, y: 150, w: 150, h: 200 };
    expect(horizontalFromCenter(bbox, CENTER_X)).toBe(20);
  });

  it("vertical_from_bottom для рукава", () => {
    const bbox: Bbox = { x: 80, y: 90, w: 80, h: 60 };
    // sleeve_bottom_y=180 − (90+60) = 30
    expect(verticalFromBottom(bbox, 180)).toBe(30);
  });

  it("полная обвязка груди", () => {
    const bbox: Bbox = { x: 200, y: 200, w: 200, h: 250 };
    const d = fullDimensions(bbox, CHEST_ZONE);
    expect(d.left).toBe(50); // 200 − 150
    expect(d.right).toBe(50); // 450 − 400
    expect(d.top).toBe(60); // 200 − 140
    expect(d.bottom).toBe(90); // 540 − 450
    expect(d.printWidth).toBe(200);
    expect(d.printHeight).toBe(250);
  });
});

describe("zone", () => {
  it("внутри зоны — не предупреждаем", () => {
    const bbox: Bbox = { x: 200, y: 200, w: 200, h: 250 };
    const c = checkZone(bbox, CHEST_ZONE, 15);
    expect(c.out_of_zone).toBe(false);
    expect(c.out_of_safe_zone).toBe(false);
  });

  it("выход за зону → out_of_zone", () => {
    const bbox: Bbox = { x: 120, y: 200, w: 200, h: 250 }; // left = -30
    const c = checkZone(bbox, CHEST_ZONE, 15);
    expect(c.out_of_zone).toBe(true);
    expect(c.dimensions.left).toBe(-30);
  });

  it("safe-zone строже обычной", () => {
    const bbox: Bbox = { x: 155, y: 200, w: 200, h: 250 }; // left = 5 < inset 15
    const c = checkZone(bbox, CHEST_ZONE, 15);
    expect(c.out_of_zone).toBe(false);
    expect(c.out_of_safe_zone).toBe(true);
  });
});

describe("grading — константа от горловины", () => {
  it("vertical_from_neckline постоянен при смене размера (front)", () => {
    const bbox: Bbox = { x: 225, y: 150, w: 150, h: 200 };
    const inv = captureInvariant(bbox, NECKLINE_Y, CENTER_X);
    // Новый размер: горловина смещена ниже, ось центра сдвинута.
    const newNeckY = 120;
    const newCenterX = 310;
    const moved = applyInvariantFrontBack(inv, newNeckY, newCenterX);
    expect(verticalFromNeckline(moved, newNeckY)).toBe(
      inv.vertical_from_neckline,
    );
    expect(horizontalFromCenter(moved, newCenterX)).toBe(
      inv.horizontal_from_center,
    );
    // Размер печати не меняется.
    expect(moved.w).toBe(bbox.w);
    expect(moved.h).toBe(bbox.h);
  });

  it("vertical_from_bottom постоянен для рукава", () => {
    const bbox: Bbox = { x: 80, y: 90, w: 80, h: 60 };
    const inv = captureSleeveInvariant(bbox, 180, 120);
    const moved = applyInvariantSleeve(inv, 200, 130);
    expect(verticalFromBottom(moved, 200)).toBe(inv.vertical_from_bottom);
    expect(moved.w).toBe(bbox.w);
    expect(moved.h).toBe(bbox.h);
  });
});

describe("regradePosition — константа от горловины между размерами", () => {
  // Мини-вид с per-size якорями (как в seed tshirt-classic front).
  const view = {
    id: "v",
    kind: "front",
    flat_svg: "",
    scale_mm_per_unit: 1,
    anchors: { neckline_point: { x: 300, y: 92 }, center_axis_x: 300 },
    size_anchors: {
      L: { neckline_point: { x: 300, y: 92 }, center_axis_x: 300 },
      XXL: { neckline_point: { x: 300, y: 104 }, center_axis_x: 300 },
    },
    print_areas: [
      {
        id: "chest",
        name: "Грудь",
        polygon_mm: [
          [150, 140],
          [450, 140],
          [450, 540],
          [150, 540],
        ] as [number, number][],
        safe_inset_mm: 15,
      },
    ],
  } as unknown as import("@/types").View;

  it("при L→XXL отступ от горловины численно постоянен", () => {
    const bbox = { x: 225, y: 150, w: 150, h: 200 };
    const before = placementInfo(view, bbox, 0, "L").anchor.vertical;
    const moved = regradePosition(view, "L", "XXL", bbox);
    const after = placementInfo(
      view,
      { x: moved.x_mm, y: moved.y_mm, w: bbox.w, h: bbox.h },
      0,
      "XXL",
    ).anchor.vertical;
    expect(after).toBeCloseTo(before, 6);
    // Горловина опустилась на 12 мм → и макет на 12 мм.
    expect(moved.y_mm).toBeCloseTo(162, 6);
    // Размер печати не изменился.
    expect(moved.x_mm).toBeCloseTo(225, 6);
  });

  it("anchorsForSize фоллбэчит на базовые якоря", () => {
    expect(anchorsForSize(view, "M")).toBe(view.anchors);
    expect(anchorsForSize(view, "XXL").neckline_point?.y).toBe(104);
  });

  it("регрейдинг инвариантен к повороту (front, 30°)", () => {
    const bbox = { x: 225, y: 150, w: 150, h: 200 };
    const before = placementInfo(view, bbox, 30, "L").anchor.vertical;
    const moved = regradePosition(view, "L", "XXL", bbox);
    const movedBbox = { x: moved.x_mm, y: moved.y_mm, w: bbox.w, h: bbox.h };
    const after = placementInfo(view, movedBbox, 30, "XXL").anchor.vertical;
    // Регрейдинг — чистый перенос → константа от горловины держится и при повороте.
    expect(after).toBeCloseTo(before, 6);
  });

  it("regradePosition без целевого якоря → no-op (исходная позиция)", () => {
    const partial = {
      ...view,
      size_anchors: {
        L: { neckline_point: { x: 300, y: 92 }, center_axis_x: 300 },
        // XXL без center_axis_x → регрейдинг невозможен.
        XXL: { neckline_point: { x: 300, y: 104 } },
      },
    } as unknown as import("@/types").View;
    const bbox = { x: 225, y: 150, w: 150, h: 200 };
    const moved = regradePosition(partial, "L", "XXL", bbox);
    expect(moved.x_mm).toBe(bbox.x);
    expect(moved.y_mm).toBe(bbox.y);
  });
});

describe("regradePosition — сквозной sleeve-регрейдинг", () => {
  const sleeveView = {
    id: "vs",
    kind: "sleeve_left",
    flat_svg: "",
    scale_mm_per_unit: 1,
    anchors: { sleeve_bottom_y: 400, sleeve_center_x: 120 },
    size_anchors: {
      L: { sleeve_bottom_y: 400, sleeve_center_x: 120 },
      XXL: { sleeve_bottom_y: 412, sleeve_center_x: 120 },
    },
    print_areas: [
      {
        id: "sleeve",
        name: "Рукав",
        polygon_mm: [
          [80, 90],
          [160, 90],
          [160, 420],
          [80, 420],
        ] as [number, number][],
        safe_inset_mm: 10,
      },
    ],
  } as unknown as import("@/types").View;

  it("L→XXL переносит bbox за нижним краем на 12, x неизменен, verticalFromBottom константен", () => {
    const bbox = { x: 80, y: 90, w: 80, h: 60 };
    const before = placementInfo(sleeveView, bbox, 0, "L").anchor.vertical;
    const moved = regradePosition(sleeveView, "L", "XXL", bbox);
    // Низ рукава опустился на 12 (400→412). Отступ снизу — КОНСТАНТА
    // (verticalFromBottom = sleeve_bottom_y − (y+h)), поэтому весь bbox
    // следует за нижним краем ровно на 12 мм. Сдвиг по модулю — 12, x неизменен.
    expect(moved.y_mm - bbox.y).toBeCloseTo(12, 6);
    expect(moved.x_mm).toBeCloseTo(bbox.x, 6);
    const movedBbox = { x: moved.x_mm, y: moved.y_mm, w: bbox.w, h: bbox.h };
    const after = placementInfo(sleeveView, movedBbox, 0, "XXL").anchor.vertical;
    expect(after).toBeCloseTo(before, 6);
  });

  it("regradePosition без sleeve-якоря → no-op", () => {
    const partial = {
      ...sleeveView,
      size_anchors: {
        L: { sleeve_bottom_y: 400, sleeve_center_x: 120 },
        XXL: { sleeve_center_x: 120 }, // нет sleeve_bottom_y
      },
    } as unknown as import("@/types").View;
    const bbox = { x: 80, y: 90, w: 80, h: 60 };
    const moved = regradePosition(partial, "L", "XXL", bbox);
    expect(moved.x_mm).toBe(bbox.x);
    expect(moved.y_mm).toBe(bbox.y);
  });
});

describe("viewZone — per-size зоны печати", () => {
  const baseArea = {
    id: "chest",
    name: "Грудь",
    polygon_mm: [
      [150, 140],
      [450, 140],
      [450, 540],
      [150, 540],
    ] as [number, number][],
    safe_inset_mm: 15,
  };
  const bigArea = { ...baseArea, polygon_mm: [
    [130, 130],
    [470, 130],
    [470, 560],
    [130, 560],
  ] as [number, number][] };
  const v = {
    kind: "front",
    print_areas: [baseArea],
    size_print_areas: { XXL: [bigArea] },
  } as unknown as import("@/types").View;

  it("базовая зона при отсутствии per-size", () => {
    const { zone } = viewZone(v, "M");
    expect(zone.zw).toBe(300); // 450−150
  });
  it("per-size зона переопределяет базовую", () => {
    const { zone } = viewZone(v, "XXL");
    expect(zone.zw).toBe(340); // 470−130
    expect(zone.zh).toBe(430); // 560−130
  });
  it("без размера — базовая", () => {
    expect(viewZone(v).zone.zw).toBe(300);
  });
});

describe("rotatedAabb", () => {
  it("поворот на 90° меняет местами ширину и высоту", () => {
    const bbox: Bbox = { x: 100, y: 100, w: 200, h: 100 };
    const a = rotatedAabb(bbox, 90);
    expect(a.w).toBeCloseTo(100, 6);
    expect(a.h).toBeCloseTo(200, 6);
    // Центр сохраняется.
    expect(a.x + a.w / 2).toBeCloseTo(200, 6);
    expect(a.y + a.h / 2).toBeCloseTo(150, 6);
  });

  it("поворот на 0° не меняет bbox", () => {
    const bbox: Bbox = { x: 10, y: 20, w: 30, h: 40 };
    const a = rotatedAabb(bbox, 0);
    expect(a).toEqual(bbox);
  });

  it("поворот на 45° квадрата 100×100 → ≈141.42, центр сохранён", () => {
    const bbox: Bbox = { x: 0, y: 0, w: 100, h: 100 };
    const a = rotatedAabb(bbox, 45);
    expect(a.w).toBeCloseTo(141.4213562, 6);
    expect(a.h).toBeCloseTo(141.4213562, 6);
    expect(a.x + a.w / 2).toBeCloseTo(50, 6);
    expect(a.y + a.h / 2).toBeCloseTo(50, 6);
  });

  it("поворот на 30° прямоугольника 200×100 → w≈223.205, h≈186.603", () => {
    const bbox: Bbox = { x: 0, y: 0, w: 200, h: 100 };
    const a = rotatedAabb(bbox, 30);
    expect(a.w).toBeCloseTo(223.2050808, 6);
    expect(a.h).toBeCloseTo(186.6025404, 6);
    expect(a.x + a.w / 2).toBeCloseTo(100, 6);
    expect(a.y + a.h / 2).toBeCloseTo(50, 6);
  });
});

describe("checkZone — границы", () => {
  it("отступ ровно = safeInsetMm → out_of_safe_zone=false", () => {
    // left = 165 − 150 = 15 = safe_inset; зеркально right.
    const bbox: Bbox = { x: 165, y: 200, w: 270, h: 250 };
    const c = checkZone(bbox, CHEST_ZONE, 15);
    expect(c.dimensions.left).toBe(15);
    expect(c.dimensions.right).toBe(15);
    expect(c.out_of_zone).toBe(false);
    expect(c.out_of_safe_zone).toBe(false);
  });

  it("отступ ровно 0 → out_of_zone=false", () => {
    // left = 150 − 150 = 0.
    const bbox: Bbox = { x: 150, y: 200, w: 300, h: 250 };
    const c = checkZone(bbox, CHEST_ZONE, 15);
    expect(c.dimensions.left).toBe(0);
    expect(c.dimensions.right).toBe(0);
    expect(c.out_of_zone).toBe(false);
  });
});
