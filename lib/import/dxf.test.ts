import { describe, it, expect } from "vitest";
import { parseDxf, processPiece } from "./dxf";

// Минимальная DXF R12: один блок-деталь (перёд), квадрат 100×200,
// вертикальная долевая (x=50), подписи Piece Name/Size.
const DXF = [
  "0", "SECTION", "2", "BLOCKS",
  "0", "BLOCK", "2", "PIECE1",
  "0", "TEXT", "1", "Piece Name: PNHD-FreeFit-2-Pered-Osnovnoe",
  "0", "TEXT", "1", "Size: M-176",
  "0", "POLYLINE", "8", "1",
  "0", "VERTEX", "10", "0", "20", "0",
  "0", "VERTEX", "10", "100", "20", "0",
  "0", "VERTEX", "10", "100", "20", "200",
  "0", "VERTEX", "10", "0", "20", "200",
  "0", "SEQEND",
  "0", "LINE", "8", "7", "10", "50", "20", "0", "11", "50", "21", "200",
  "0", "ENDBLK",
  "0", "ENDSEC", "0", "EOF",
].join("\n");

describe("dxf parser", () => {
  it("находит деталь, размер и тип", () => {
    const { pieces } = parseDxf(DXF);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].kind).toBe("front");
    expect(pieces[0].size).toBe("M-176");
    expect(pieces[0].piece).toContain("Pered");
  });

  it("processPiece даёт габариты в мм, ось и SVG", () => {
    const { blocks, pieces } = parseDxf(DXF);
    const r = processPiece(blocks, pieces[0]);
    expect(r.wMm).toBe(100);
    expect(r.hMm).toBe(200);
    expect(r.cx).toBe(50); // долевая по центру
    expect(r.kind).toBe("front");
    expect(r.svg).toContain("<path id=\"garment\"");
    expect(r.anchors.center_axis_x).toBe(50);
  });
});
