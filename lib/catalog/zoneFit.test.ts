// Регресс-выверка: каждая печатная зона (база + per-size) лежит ВНУТРИ
// силуэта своего флэта (по viewBox). Ловит «вылет зоны за изделие».
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { catalogSchema } from "./schema";

const root = process.cwd();
const catalog = catalogSchema.parse(
  JSON.parse(readFileSync(resolve(root, "public/seed/skus.json"), "utf-8")),
);

function flatBox(flatSvg: string): { w: number; h: number } {
  const svg = readFileSync(resolve(root, "public", flatSvg.replace(/^\//, "")), "utf-8");
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!m) throw new Error(`нет viewBox в ${flatSvg}`);
  return { w: parseFloat(m[1]), h: parseFloat(m[2]) };
}

function inside(poly: [number, number][], w: number, h: number): boolean {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return Math.min(...xs) >= 0 && Math.min(...ys) >= 0 && Math.max(...xs) <= w && Math.max(...ys) <= h;
}

describe("выверка зон: внутри силуэта флэта", () => {
  for (const sku of catalog.skus) {
    // Пропускаем SKU с data-URL флэтами (черновики) — у них нет файла.
    for (const view of sku.views) {
      if (!view.flat_svg.startsWith("/")) continue;
      const { w, h } = flatBox(view.flat_svg);
      it(`${sku.id}/${view.kind}: базовые зоны внутри ${w}×${h}`, () => {
        for (const a of view.print_areas) {
          expect(inside(a.polygon_mm, w, h), `${a.name} вне силуэта`).toBe(true);
        }
      });
      if (view.size_print_areas) {
        it(`${sku.id}/${view.kind}: per-size зоны внутри силуэта`, () => {
          for (const [size, areas] of Object.entries(view.size_print_areas!)) {
            for (const a of areas) {
              expect(inside(a.polygon_mm, w, h), `${size}/${a.name} вне силуэта`).toBe(true);
            }
          }
        });
      }
    }
  }
});
