import { describe, it, expect } from "vitest";
import { parseDxf } from "./dxf";
import { buildSkuFromDxf } from "./dxfSku";
import { catalogSchema } from "@/lib/catalog/schema";

// Перёд для двух размеров (M и L) — проверяем многоразмерную сборку.
function piece(name: string, size: string, w: number, h: number): string {
  return [
    "0", "BLOCK", "2", `${name}_${size}`,
    "0", "TEXT", "1", `Piece Name: FreeFit-2-Pered-Osnovnoe`,
    "0", "TEXT", "1", `Size: ${size}`,
    "0", "POLYLINE", "8", "1",
    "0", "VERTEX", "10", "0", "20", "0",
    "0", "VERTEX", "10", String(w), "20", "0",
    "0", "VERTEX", "10", String(w), "20", String(h),
    "0", "VERTEX", "10", "0", "20", String(h),
    "0", "SEQEND",
    "0", "LINE", "8", "7", "10", String(w / 2), "20", "0", "11", String(w / 2), "21", String(h),
    "0", "ENDBLK",
  ].join("\n");
}

const DXF = [
  "0", "SECTION", "2", "BLOCKS",
  piece("P", "M-176", 600, 750),
  piece("P", "L-176", 640, 790),
  "0", "ENDSEC", "0", "EOF",
].join("\n");

describe("buildSkuFromDxf", () => {
  it("собирает валидный по схеме SKU с видом перёд и размерами", () => {
    const parsed = parseDxf(DXF);
    const sku = buildSkuFromDxf(parsed, { skuId: "x", skuName: "X" });
    expect(catalogSchema.safeParse({ skus: [sku] }).success).toBe(true);
    expect(sku.sizes).toEqual(["M", "L"]);
    const front = sku.views.find((v) => v.kind === "front")!;
    expect(front).toBeTruthy();
    // size_anchors покрывают оба размера, ось центра — константа.
    expect(Object.keys(front.size_anchors ?? {})).toEqual(["M", "L"]);
    expect(front.size_anchors!.M.center_axis_x).toBe(
      front.size_anchors!.L.center_axis_x,
    );
    // per-size зоны масштабируются (L шире M).
    const zoneW = (a: [number, number][]) => a[1][0] - a[0][0];
    expect(zoneW(front.size_print_areas!.L[0].polygon_mm)).toBeGreaterThan(
      zoneW(front.size_print_areas!.M[0].polygon_mm),
    );
  });
});
