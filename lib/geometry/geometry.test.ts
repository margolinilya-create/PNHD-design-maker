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
import { placementInfo, regradePosition, anchorsForSize } from "./view";

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
});
