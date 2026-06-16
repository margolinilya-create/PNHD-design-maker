// Получение SVG-разметки флэта: из data URL (DXF/черновик) или по сети (seed-файл).
// Единый формат data URL — base64 (надёжно и для <img>, и для декода).

/** Перекрасить заливку силуэта (элемент id="garment") в цвет ткани. */
export function recolorGarment(svg: string, color: string): string {
  if (!color) return svg;
  return svg.replace(/(<[^>]*\bid="garment"[^>]*?)fill="[^"]*"/i, `$1fill="${color}"`);
}

/** SVG-строка → data URL (base64, UTF-8-safe). */
export function svgToDataUrl(svg: string): string {
  const b64 =
    typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(svg)))
      : Buffer.from(svg, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
}

/** Декод текстового содержимого data URL (base64 / percent / raw utf8). */
export function decodeDataUrlText(url: string): string {
  const comma = url.indexOf(",");
  if (comma < 0) return "";
  const meta = url.slice(0, comma);
  const data = url.slice(comma + 1);
  if (/;base64/i.test(meta)) {
    const bin =
      typeof atob === "function"
        ? atob(data)
        : Buffer.from(data, "base64").toString("binary");
    try {
      return decodeURIComponent(escape(bin));
    } catch {
      return bin;
    }
  }
  // ;utf8, или percent-encoded
  try {
    return decodeURIComponent(data);
  } catch {
    return data;
  }
}

/** Разметка флэта: data URL декодируем, иначе грузим по сети. */
export async function resolveFlatMarkup(flatSvg: string): Promise<string> {
  if (flatSvg.startsWith("data:")) return decodeDataUrlText(flatSvg);
  return fetch(flatSvg).then((r) => r.text());
}
