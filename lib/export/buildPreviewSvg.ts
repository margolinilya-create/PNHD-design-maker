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
}

const escAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function innerSvg(markup: string): string {
  const m = markup.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return m ? m[1] : "";
}

/** SVG чистого превью (для растеризации в PNG). */
export function buildPreviewSvg(input: PreviewInput): string {
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
