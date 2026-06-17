// Чистое клиентское превью вида: флэт (+цвет ткани) + макеты, замаскированные
// по зонам. Без тех-линий (зон/обвязки/сетки/рамки). Фон прозрачный.
import type { Asset, Placement, View } from "@/types";
import { viewZone } from "@/lib/geometry/view";
import { recolorGarment } from "./flatMarkup";

export interface PreviewInput {
  view: View;
  flatSvgMarkup: string;
  flatMm: { w: number; h: number };
  scaleMmPerUnit?: number;
  garmentColor?: string;
  size?: string;
  placements: Placement[];
  assets: Record<string, Asset>;
  /** Фото-мокап: фото (data URL) + его размеры + положение зоны на фото. */
  mockup?: {
    dataUrl: string;
    imgW: number;
    imgH: number;
    print: { x: number; y: number; w: number };
  };
}

/** Превью на фото изделия: фото-подложка + макет в печатной зоне (multiply). */
function buildMockupSvg(input: PreviewInput): string {
  const { view, placements, assets, size, mockup } = input;
  const { dataUrl, imgW, imgH, print } = mockup!;

  const placementSvg = placements
    .map((p, i) => {
      const asset = assets[p.asset_id];
      if (!asset?.data_url || p.hidden) return "";
      const { zone } = viewZone(view, size, p.print_area_id);
      const scale = (print.w * imgW) / zone.zw; // px фото на мм
      const ox = print.x * imgW;
      const oy = print.y * imgH;
      const PX = ox + (p.x_mm - zone.zx) * scale;
      const PY = oy + (p.y_mm - zone.zy) * scale;
      const PW = p.width_mm * scale;
      const PH = p.height_mm * scale;
      const cx = PX + PW / 2;
      const cy = PY + PH / 2;
      const sx = p.flip_h ? -1 : 1;
      const sy = p.flip_v ? -1 : 1;
      const href = escAttr(asset.data_url);
      // Клип по зоне на фото, чтобы макет не вылезал на рукава/ворот.
      const clip = `<clipPath id="mk-${i}"><rect x="${ox}" y="${oy}" width="${zone.zw * scale}" height="${zone.zh * scale}"/></clipPath>`;
      return {
        clip,
        body: `<g clip-path="url(#mk-${i})" style="mix-blend-mode:multiply"><g transform="rotate(${p.rotation_deg} ${cx} ${cy}) translate(${cx} ${cy}) scale(${sx} ${sy}) translate(${-cx} ${-cy})">
          <image href="${href}" xlink:href="${href}" x="${PX}" y="${PY}" width="${PW}" height="${PH}" preserveAspectRatio="none"/>
        </g></g>`,
      };
    })
    .filter(Boolean) as { clip: string; body: string }[];

  const bgHref = escAttr(dataUrl);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${imgW}" height="${imgH}" viewBox="0 0 ${imgW} ${imgH}">
  <defs>${placementSvg.map((x) => x.clip).join("")}</defs>
  <image href="${bgHref}" xlink:href="${bgHref}" x="0" y="0" width="${imgW}" height="${imgH}"/>
  ${placementSvg.map((x) => x.body).join("")}
</svg>`;
}

const escAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function innerSvg(markup: string): string {
  const m = markup.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return m ? m[1] : "";
}

/** SVG чистого превью (для растеризации в PNG). */
export function buildPreviewSvg(input: PreviewInput): string {
  if (input.mockup) return buildMockupSvg(input);
  const { view, flatMm, placements, assets, size } = input;
  const W = flatMm.w;
  const H = flatMm.h;

  const clipDefs = placements
    .map((p, i) => {
      const { zone } = viewZone(view, size, p.print_area_id);
      return `<clipPath id="pc-${i}"><rect x="${zone.zx}" y="${zone.zy}" width="${zone.zw}" height="${zone.zh}"/></clipPath>`;
    })
    .join("");

  const placementSvg = placements
    .map((p, i) => {
      const asset = assets[p.asset_id];
      if (!asset?.data_url || p.hidden) return "";
      const cx = p.x_mm + p.width_mm / 2;
      const cy = p.y_mm + p.height_mm / 2;
      const sx = p.flip_h ? -1 : 1;
      const sy = p.flip_v ? -1 : 1;
      const href = escAttr(asset.data_url);
      return `<g clip-path="url(#pc-${i})"><g transform="rotate(${p.rotation_deg} ${cx} ${cy}) translate(${cx} ${cy}) scale(${sx} ${sy}) translate(${-cx} ${-cy})">
        <image href="${href}" xlink:href="${href}" x="${p.x_mm}" y="${p.y_mm}" width="${p.width_mm}" height="${p.height_mm}" preserveAspectRatio="none"/>
      </g></g>`;
    })
    .join("");

  const flat = innerSvg(recolorGarment(input.flatSvgMarkup, input.garmentColor ?? ""));

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${clipDefs}</defs>
  <g transform="scale(${input.scaleMmPerUnit ?? 1})">${flat}</g>
  ${placementSvg}
</svg>`;
}
