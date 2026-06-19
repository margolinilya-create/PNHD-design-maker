import { describe, it, expect } from "vitest";
import { preflight, hasBlockingErrors } from "./preflight";
import type { Asset, Placement, View } from "@/types";

const view: View = {
  id: "v-front",
  kind: "front",
  flat_svg: "",
  scale_mm_per_unit: 1,
  anchors: { neckline_point: { x: 300, y: 92 }, center_axis_x: 300 },
  print_areas: [
    {
      id: "chest",
      name: "Грудь",
      polygon_mm: [
        [150, 140],
        [450, 140],
        [450, 540],
        [150, 540],
      ],
      safe_inset_mm: 15,
    },
  ],
};

const basePlacement = (over: Partial<Placement> = {}): Placement => ({
  id: "p1",
  print_area_id: "chest",
  asset_id: "a1",
  x_mm: 200,
  y_mm: 200,
  width_mm: 100,
  height_mm: 100,
  rotation_deg: 0,
  ...over,
});

const goodPng: Asset = {
  id: "a1",
  type: "png",
  source_file: "logo.png",
  intrinsic_size_mm: { width: 100, height: 100 },
  px_width: 1500,
  px_height: 1500,
};

describe("preflight", () => {
  it("пустой проект → блокирующая ошибка", () => {
    const issues = preflight({ views: [view], placements: [], assets: {} });
    expect(hasBlockingErrors(issues)).toBe(true);
  });

  it("чистый кейс (DTF, 300+ DPI, в зоне, метод задан) → без проблем", () => {
    const issues = preflight({
      views: [view],
      placements: [basePlacement({ method: "dtf" })],
      assets: { a1: goodPng },
    });
    expect(issues).toHaveLength(0);
  });

  it("метод не задан и нет дефолта зоны → warn", () => {
    const issues = preflight({
      views: [view],
      placements: [basePlacement()],
      assets: { a1: goodPng },
    });
    expect(issues.some((i) => i.message.includes("метод печати не задан"))).toBe(
      true,
    );
  });

  it("дефолт зоны снимает предупреждение о методе", () => {
    const embView: View = {
      ...view,
      print_areas: [{ ...view.print_areas[0], default_method: "embroidery" }],
    };
    const issues = preflight({
      views: [embView],
      placements: [basePlacement()],
      assets: { a1: goodPng },
    });
    expect(issues.some((i) => i.message.includes("метод печати не задан"))).toBe(
      false,
    );
  });

  it("низкое разрешение для DTF → warn", () => {
    const lowPng: Asset = { ...goodPng, px_width: 300, px_height: 300 };
    const issues = preflight({
      views: [view],
      placements: [basePlacement({ method: "dtf" })],
      assets: { a1: lowPng },
    });
    expect(issues.some((i) => i.message.includes("низкое разрешение"))).toBe(
      true,
    );
  });

  it("выход за зону → warn", () => {
    const issues = preflight({
      views: [view],
      // ширина 400 в зоне 300 → выходит за правый край
      placements: [basePlacement({ method: "dtf", x_mm: 160, width_mm: 400 })],
      assets: { a1: goodPng },
    });
    expect(issues.some((i) => i.message.includes("за печатную зону"))).toBe(
      true,
    );
  });

  it("превышение max_print_mm зоны → warn", () => {
    const viewMax: View = {
      ...view,
      print_areas: [
        { ...view.print_areas[0], max_print_mm: { width: 200, height: 200 } },
      ],
    };
    const issues = preflight({
      views: [viewMax],
      // ширина 250 > max 200
      placements: [basePlacement({ method: "dtf", width_mm: 250 })],
      assets: { a1: goodPng },
    });
    expect(issues.some((i) => i.message.includes("превышает максимум"))).toBe(
      true,
    );
  });

  it("меньше min_print_mm зоны → warn", () => {
    const viewMin: View = {
      ...view,
      print_areas: [
        { ...view.print_areas[0], min_print_mm: { width: 50, height: 50 } },
      ],
    };
    const issues = preflight({
      views: [viewMin],
      placements: [
        basePlacement({ method: "dtf", width_mm: 30, height_mm: 30 }),
      ],
      assets: { a1: goodPng },
    });
    expect(issues.some((i) => i.message.includes("меньше минимума"))).toBe(true);
  });

  it("оценочный размер → warn", () => {
    const estPng: Asset = { ...goodPng, size_estimated: true };
    const issues = preflight({
      views: [view],
      placements: [basePlacement({ method: "dtf" })],
      assets: { a1: estPng },
    });
    expect(issues.some((i) => i.message.includes("размер оценочный"))).toBe(
      true,
    );
  });
});
