import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { catalogSchema } from "./schema";

// Страж: seed обязан проходить (ужесточённую) валидацию каталога,
// иначе приложение упадёт при загрузке в рантайме.
describe("seed skus.json", () => {
  it("валиден по catalogSchema", () => {
    const file = path.resolve(__dirname, "../../public/seed/skus.json");
    const json = JSON.parse(readFileSync(file, "utf8"));
    const res = catalogSchema.safeParse(json);
    if (!res.success) {
      throw new Error(JSON.stringify(res.error.issues, null, 2));
    }
    expect(res.success).toBe(true);
  });
});
