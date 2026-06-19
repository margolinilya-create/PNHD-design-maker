// Парсер DXF-выкройки (R12/AAMA) → флэт в мм + якоря.
// TS-порт scripts/dxf_to_flat.py: деталь ориентируется по долевой нити,
// нормализуется в мм, якоря выводятся из геометрии.
import type { ViewKind, ViewAnchors } from "@/types";

type Pair = [number, string];
type Pt = { x: number; y: number };

interface Poly {
  layer: string | null;
  pts: Pt[];
  _x?: number;
}
interface DxfLine {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}
interface Block {
  polys: Poly[];
  lines: DxfLine[];
  texts: string[];
}

function readPairs(text: string): Pair[] {
  const lines = text.split(/\r?\n/);
  const out: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) continue;
    out.push([code, lines[i + 1]]);
  }
  return out;
}

function num(v: string): number | null {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function parseBlocks(pairs: Pair[]): Map<string, Block> {
  const blocks = new Map<string, Block>();
  let curBlock: string | null = null;
  let curType: string | null = null;
  let openPoly: Poly | null = null;
  let line: DxfLine | null = null;
  let pendText = false;

  const ensure = (n: string) => {
    if (!blocks.has(n)) blocks.set(n, { polys: [], lines: [], texts: [] });
    return blocks.get(n)!;
  };

  for (const [code, val] of pairs) {
    if (code === 0) {
      const v = val.trim();
      if (v === "SEQEND" && openPoly && curBlock) {
        ensure(curBlock).polys.push(openPoly);
        openPoly = null;
      }
      if (curType === "LINE" && line && curBlock) {
        ensure(curBlock).lines.push(line);
        line = null;
      }
      curType = v;
      if (v === "BLOCK") curBlock = "?";
      else if (v === "ENDBLK") curBlock = null;
      else if (v === "POLYLINE") openPoly = { layer: null, pts: [] };
      else if (v === "LINE") line = {};
      else if (v === "TEXT") pendText = true;
    } else if (code === 2 && curType === "BLOCK") {
      curBlock = val.trim();
      ensure(curBlock);
    } else if (code === 8) {
      if (curType === "POLYLINE" && openPoly && openPoly.layer === null)
        openPoly.layer = val.trim();
    } else if (code === 10) {
      const x = num(val);
      if (x === null) continue;
      if (curType === "VERTEX" && openPoly) openPoly._x = x;
      else if (curType === "LINE" && line) line.x1 = x;
    } else if (code === 20) {
      const y = num(val);
      if (y === null) continue;
      if (curType === "VERTEX" && openPoly && openPoly._x !== undefined)
        openPoly.pts.push({ x: openPoly._x, y });
      else if (curType === "LINE" && line) line.y1 = y;
    } else if (code === 11 && curType === "LINE" && line) {
      line.x2 = num(val) ?? undefined;
    } else if (code === 21 && curType === "LINE" && line) {
      line.y2 = num(val) ?? undefined;
    } else if (code === 1 && pendText && curBlock) {
      ensure(curBlock).texts.push(val.trim());
      pendText = false;
    }
  }
  return blocks;
}

export interface PieceRef {
  block: string;
  piece: string; // полное имя детали
  size: string; // метка размера
  kind: ViewKind | "label";
}

function pieceKind(name: string): ViewKind | "label" {
  const n = name.toLowerCase();
  if (n.includes("pered")) return "front";
  if (n.includes("spinka")) return "back";
  if (n.includes("rukav")) return "sleeve_left";
  return "label"; // обтачка/рибана и пр.
}

/** Перечислить детали (блоки) с именами и размерами. */
export function listPieces(blocks: Map<string, Block>): PieceRef[] {
  const out: PieceRef[] = [];
  for (const [name, b] of blocks) {
    const pn = b.texts.find((t) => t.includes("Piece Name"));
    const sz = b.texts.find((t) => t.startsWith("Size"));
    if (!pn) continue;
    const piece = pn.replace(/Piece Name:/, "").trim();
    const size = (sz ?? "").replace(/Size:/, "").trim();
    out.push({ block: name, piece, size, kind: pieceKind(piece) });
  }
  return out;
}

function boundary(b: Block): Pt[] {
  const cands = b.polys.filter((p) => p.pts.length >= 3);
  const area = (p: Poly) => {
    const xs = p.pts.map((q) => q.x);
    const ys = p.pts.map((q) => q.y);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  };
  return cands.reduce((a, b2) => (area(b2) > area(a) ? b2 : a)).pts;
}

function grainline(b: Block): DxfLine | null {
  let best: DxfLine | null = null;
  let bl = -1;
  for (const l of b.lines) {
    if ([l.x1, l.y1, l.x2, l.y2].some((v) => v === undefined)) continue;
    const d = Math.hypot(l.x2! - l.x1!, l.y2! - l.y1!);
    if (d > bl) {
      bl = d;
      best = l;
    }
  }
  return best;
}

function rot(pts: Pt[], theta: number, ox: number, oy: number): Pt[] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return pts.map(({ x, y }) => ({
    x: (x - ox) * c - (y - oy) * s,
    y: (x - ox) * s + (y - oy) * c,
  }));
}

export interface ProcessedPiece {
  svg: string;
  anchors: ViewAnchors;
  wMm: number;
  hMm: number;
  cx: number;
  necklineY: number | null;
  kind: ViewKind | "label";
}

/** Обработать деталь: ориентация по долевой, нормализация в мм, якоря, SVG. */
export function processPiece(
  blocks: Map<string, Block>,
  ref: PieceRef,
): ProcessedPiece {
  const b = blocks.get(ref.block)!;
  const pts = boundary(b);
  const gl = grainline(b);
  const ang = gl ? Math.atan2(gl.y2! - gl.y1!, gl.x2! - gl.x1!) : Math.PI / 2;
  const theta = Math.PI / 2 - ang;
  const glx = gl ? (gl.x1! + gl.x2!) / 2 : 0;
  const gly = gl ? (gl.y1! + gl.y2!) / 2 : 0;
  const P = rot(pts, theta, glx, gly);
  const G = gl
    ? rot([{ x: gl.x1!, y: gl.y1! }, { x: gl.x2!, y: gl.y2! }], theta, glx, gly)
    : [{ x: 0, y: 0 }];
  const xs = P.map((p) => p.x);
  const ys = P.map((p) => p.y);
  const minx = Math.min(...xs);
  const miny = Math.min(...ys);
  const w = Math.max(...xs) - minx;
  const h = Math.max(...ys) - miny;
  let N = P.map((p) => ({ x: p.x - minx, y: p.y - miny }));
  const cx = G[0].x - minx;
  const sleeve = ref.kind === "sleeve_left" || ref.kind === "sleeve_right";

  const scoop = (top: boolean): number => {
    const band = N.filter(
      (p) => Math.abs(p.x - cx) < 0.18 * w && (top ? p.y < h * 0.5 : p.y > h * 0.5),
    );
    if (!band.length) return 0;
    if (top) {
      const ext = Math.min(...N.map((p) => p.y));
      const dip = Math.max(...band.map((p) => p.y));
      return dip - ext;
    }
    const ext = Math.max(...N.map((p) => p.y));
    const dip = Math.min(...band.map((p) => p.y));
    return ext - dip;
  };
  if (scoop(true) < scoop(false)) N = N.map((p) => ({ x: p.x, y: h - p.y }));

  let anchors: ViewAnchors;
  let necklineY: number | null = null;
  if (sleeve) {
    anchors = { sleeve_bottom_y: round1(h), sleeve_center_x: round1(cx) };
  } else {
    const band = N.filter((p) => Math.abs(p.x - cx) < 0.18 * w && p.y < h * 0.5);
    necklineY = band.length ? round1(Math.max(...band.map((p) => p.y))) : 0;
    anchors = { neckline_point: { x: round1(cx), y: necklineY }, center_axis_x: round1(cx) };
  }

  const d = "M " + N.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ") + " Z";
  let svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}">` +
    `<path id="garment" d="${d}" fill="#ffffff" stroke="#5b6470" stroke-width="3" stroke-linejoin="round"/>` +
    `<line id="center-axis" x1="${cx.toFixed(1)}" y1="0" x2="${cx.toFixed(1)}" y2="${h.toFixed(0)}" stroke="#3b4350" stroke-width="1.5" stroke-dasharray="6 8"/>`;
  if (sleeve)
    svg += `<line id="sleeve-bottom" x1="0" y1="${h.toFixed(0)}" x2="${w.toFixed(0)}" y2="${h.toFixed(0)}" stroke="#ff5a5f" stroke-width="3"/>`;
  else
    svg += `<circle id="neckline-point" cx="${round1(cx)}" cy="${necklineY}" r="6" fill="#ff5a5f"/>`;
  svg += "</svg>";

  return { svg, anchors, wMm: round1(w), hMm: round1(h), cx: round1(cx), necklineY, kind: ref.kind };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Полный разбор DXF-текста → детали. */
export function parseDxf(text: string) {
  const blocks = parseBlocks(readPairs(text));
  return { blocks, pieces: listPieces(blocks) };
}
