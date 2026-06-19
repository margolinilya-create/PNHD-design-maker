import { describe, it, expect } from "vitest";
import { PANTONE_SWATCHES, pantoneHex } from "./pantone";

describe("pantone", () => {
  it("библиотека непустая, коды уникальны", () => {
    expect(PANTONE_SWATCHES.length).toBeGreaterThan(10);
    const codes = PANTONE_SWATCHES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("pantoneHex резолвит код, иначе undefined", () => {
    expect(pantoneHex("PMS 286 C")).toBe("#0033a0");
    expect(pantoneHex("нет такого")).toBeUndefined();
  });
});
