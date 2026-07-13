import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { recolorGarment } from "@/lib/export/flatMarkup";

// Контракт seed-флэтов (в т.ч. конвертированных из визуалок .ai):
// файл существует, viewBox в мм, ткань перекрашивается через id="garment".
const ROOT = path.resolve(__dirname, "../../public");

function seedFlatPaths(): string[] {
  const seed = JSON.parse(
    readFileSync(path.join(ROOT, "seed/skus.json"), "utf8"),
  );
  const files = new Set<string>();
  for (const sku of seed.skus) {
    for (const v of sku.views) {
      files.add(v.flat_svg);
      for (const f of Object.values(v.size_flats ?? {})) {
        files.add(f as string);
      }
    }
  }
  return [...files];
}

describe("seed-флэты", () => {
  const flats = seedFlatPaths();

  it("в seed есть хотя бы один флэт", () => {
    expect(flats.length).toBeGreaterThan(0);
  });

  for (const rel of seedFlatPaths()) {
    describe(rel, () => {
      const markup = readFileSync(path.join(ROOT, rel), "utf8");

      it("имеет viewBox (мм) и id=\"garment\" с fill", () => {
        expect(markup).toMatch(/viewBox="/);
        expect(markup).toMatch(/<[^>]*\bid="garment"[^>]*fill="/i);
      });

      it("перекрашивается recolorGarment", () => {
        const red = recolorGarment(markup, "#e11d48");
        expect(red).not.toBe(markup);
        expect(red).toContain('fill="#e11d48"');
      });

      it("без растров внутри (вектор для PDF)", () => {
        expect(markup).not.toContain("<image");
      });
    });
  }
});
