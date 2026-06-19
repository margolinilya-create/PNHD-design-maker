import { describe, it, expect } from "vitest";
import {
  PRINT_METHODS,
  PRINT_METHOD_LIST,
  DEFAULT_PRINT_METHOD,
  printMethodProfile,
  resolveMethod,
} from "./printMethod";

describe("printMethodProfile", () => {
  it("возвращает профиль по методу", () => {
    expect(printMethodProfile("screenprint").id).toBe("screenprint");
    expect(printMethodProfile("embroidery").detail).toBeDefined();
    expect(printMethodProfile("dtf").dpi).toEqual({ good: 300, min: 150 });
  });
  it("фоллбэк на DTF при undefined", () => {
    expect(printMethodProfile(undefined).id).toBe(DEFAULT_PRINT_METHOD);
  });
  it("DTF — CMYK без Pantone; шелкография/вышивка — spot/Pantone", () => {
    expect(PRINT_METHODS.dtf.pantone).toBe(false);
    expect(PRINT_METHODS.dtf.colorMode).toBe("cmyk");
    expect(PRINT_METHODS.screenprint.pantone).toBe(true);
    expect(PRINT_METHODS.embroidery.colorMode).toBe("spot");
  });
  it("список покрывает три согласованных метода", () => {
    expect(PRINT_METHOD_LIST.map((m) => m.id).sort()).toEqual([
      "dtf",
      "embroidery",
      "screenprint",
    ]);
  });
});

describe("resolveMethod", () => {
  it("приоритет: нанесение → дефолт зоны → DTF", () => {
    expect(resolveMethod("screenprint", "embroidery")).toBe("screenprint");
    expect(resolveMethod(undefined, "embroidery")).toBe("embroidery");
    expect(resolveMethod(undefined, undefined)).toBe("dtf");
  });
});
