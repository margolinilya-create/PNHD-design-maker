import { describe, it, expect } from "vitest";
import { capRevisions, sameSku, REVISION_CAP } from "./modelRevisions";
import type { SKU } from "@/types";

const mk = (name: string): SKU => ({
  id: "x",
  name,
  type: "tshirt",
  base_size: "M",
  sizes: ["M"],
  views: [],
});

describe("capRevisions", () => {
  it("обрезает до cap, сохраняя порядок (свежие первыми)", () => {
    const list = Array.from({ length: REVISION_CAP + 5 }, (_, i) => i);
    const capped = capRevisions(list, REVISION_CAP);
    expect(capped).toHaveLength(REVISION_CAP);
    expect(capped[0]).toBe(0);
  });

  it("короткий список не меняется", () => {
    const list = [1, 2, 3];
    expect(capRevisions(list, 20)).toBe(list);
  });
});

describe("sameSku", () => {
  it("идентичные — true, различные — false", () => {
    expect(sameSku(mk("a"), mk("a"))).toBe(true);
    expect(sameSku(mk("a"), mk("b"))).toBe(false);
  });
});
