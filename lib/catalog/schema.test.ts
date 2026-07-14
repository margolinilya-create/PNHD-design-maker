import { describe, it, expect } from "vitest";
import { printAreaSchema } from "./schema";

const base = {
  id: "chest",
  name: "Грудь",
  polygon_mm: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ],
  safe_inset_mm: 5,
};

describe("printAreaSchema — допустимые методы зоны", () => {
  it("methods опционален и проходит roundtrip", () => {
    expect(printAreaSchema.safeParse(base).success).toBe(true);
    const withMethods = { ...base, methods: ["dtf", "screenprint"] };
    const res = printAreaSchema.safeParse(withMethods);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.methods).toEqual(["dtf", "screenprint"]);
  });

  it("неизвестный метод отклоняется", () => {
    expect(
      printAreaSchema.safeParse({ ...base, methods: ["laser"] }).success,
    ).toBe(false);
  });

  it("default_method обязан входить в methods (superRefine)", () => {
    expect(
      printAreaSchema.safeParse({
        ...base,
        default_method: "embroidery",
        methods: ["dtf"],
      }).success,
    ).toBe(false);
    // Согласованные — ок; без methods дефолт свободен.
    expect(
      printAreaSchema.safeParse({
        ...base,
        default_method: "dtf",
        methods: ["dtf"],
      }).success,
    ).toBe(true);
    expect(
      printAreaSchema.safeParse({ ...base, default_method: "embroidery" })
        .success,
    ).toBe(true);
  });
});
