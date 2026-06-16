import { describe, it, expect } from "vitest";
import { svgToDataUrl, decodeDataUrlText, resolveFlatMarkup } from "./flatMarkup";

const svg = '<svg viewBox="0 0 10 20"><path d="M0 0"/><text>горловина</text></svg>';

describe("flatMarkup", () => {
  it("svgToDataUrl ↔ decodeDataUrlText round-trip (UTF-8)", () => {
    const url = svgToDataUrl(svg);
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(decodeDataUrlText(url)).toBe(svg);
  });

  it("декодит percent-encoded (;utf8,)", () => {
    const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    expect(decodeDataUrlText(url)).toBe(svg);
  });

  it("resolveFlatMarkup декодит data URL без сети", async () => {
    expect(await resolveFlatMarkup(svgToDataUrl(svg))).toBe(svg);
  });
});
