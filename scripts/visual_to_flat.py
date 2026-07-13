#!/usr/bin/env python3
"""Конвертация визуалки готового изделия (.ai/PDF, 1:1) в SVG-флэты каталога.

Вход — фирменный файл «визуалки … 1к1.ai» (PDF-совместимый AI, артборд = посадка,
на артборде перёд и спинка рядом). Выход — по SVG на вид в конвенции флэта
(flat-svg-convention): viewBox в мм, scale_mm_per_unit = 1, вся ткань в группе
`<g id="garment" fill="…">` без per-path заливок — recolorGarment перекрашивает
одну группу, детали (строчки, контуры) сохраняют свои цвета.

Использование:
  python3 scripts/visual_to_flat.py file.ai --previews out/        # превью артбордов
  python3 scripts/visual_to_flat.py file.ai --page 2 \
      --out-dir public/seed/flats --prefix freefit [--decimals 1]

Печатает JSON с габаритами и черновой оценкой якорей (горловина/ось) — числа
выверяются в /admin и переносятся в public/seed/skus.json.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    sys.exit("Нужен PyMuPDF: pip install pymupdf")

PT2MM = 25.4 / 72.0


def hex_color(rgb) -> str:
    if rgb is None:
        return "none"
    r, g, b = (max(0, min(255, round(c * 255))) for c in rgb)
    return f"#{r:02x}{g:02x}{b:02x}"


def fmt(v: float, decimals: int) -> str:
    s = f"{v:.{decimals}f}"
    return s.rstrip("0").rstrip(".") if "." in s else s


class HalfBuilder:
    """Собирает SVG одной половины артборда (перёд или спинка)."""

    def __init__(self, decimals: int):
        self.decimals = decimals
        self.drawings: list[dict] = []
        self.bbox: fitz.Rect | None = None

    def add(self, d: dict):
        self.drawings.append(d)
        r = d["rect"]
        self.bbox = r if self.bbox is None else self.bbox | r

    # --- построение path data (в мм, со сдвигом origin) ---
    def _pt(self, p, ox, oy) -> str:
        return f"{fmt(p.x * PT2MM - ox, self.decimals)},{fmt(p.y * PT2MM - oy, self.decimals)}"

    def _path_d(self, d: dict, ox: float, oy: float) -> str:
        parts: list[str] = []
        cur = None
        for item in d["items"]:
            kind = item[0]
            if kind == "l":
                p1, p2 = item[1], item[2]
                if cur is None or cur != p1:
                    parts.append(f"M {self._pt(p1, ox, oy)}")
                parts.append(f"L {self._pt(p2, ox, oy)}")
                cur = p2
            elif kind == "c":
                p1, c1, c2, p2 = item[1], item[2], item[3], item[4]
                if cur is None or cur != p1:
                    parts.append(f"M {self._pt(p1, ox, oy)}")
                parts.append(
                    f"C {self._pt(c1, ox, oy)} {self._pt(c2, ox, oy)} {self._pt(p2, ox, oy)}"
                )
                cur = p2
            elif kind == "re":
                r = item[1]
                parts.append(
                    f"M {fmt(r.x0 * PT2MM - ox, self.decimals)},{fmt(r.y0 * PT2MM - oy, self.decimals)} "
                    f"H {fmt(r.x1 * PT2MM - ox, self.decimals)} "
                    f"V {fmt(r.y1 * PT2MM - oy, self.decimals)} "
                    f"H {fmt(r.x0 * PT2MM - ox, self.decimals)} Z"
                )
                cur = None
            elif kind == "qu":
                q = item[1]
                pts = [q.ul, q.ur, q.lr, q.ll]
                parts.append(f"M {self._pt(pts[0], ox, oy)}")
                for p in pts[1:]:
                    parts.append(f"L {self._pt(p, ox, oy)}")
                parts.append("Z")
                cur = None
        if d.get("closePath"):
            parts.append("Z")
        return " ".join(parts)

    def fabric_fill(self) -> str | None:
        """Доминирующая по площади заливка = ткань."""
        area = defaultdict(float)
        for d in self.drawings:
            if d["type"] in ("f", "fs") and d.get("fill") is not None:
                r = d["rect"]
                area[hex_color(d["fill"])] += r.width * r.height
        if not area:
            return None
        return max(area, key=area.get)

    def to_svg(self) -> tuple[str, dict]:
        assert self.bbox is not None, "пустая половина"
        ox, oy = self.bbox.x0 * PT2MM, self.bbox.y0 * PT2MM
        w, h = self.bbox.width * PT2MM, self.bbox.height * PT2MM
        fabric = self.fabric_fill() or "#d6d6d6"

        body: list[str] = []
        for d in self.drawings:
            attrs: list[str] = []
            fill = hex_color(d.get("fill")) if d["type"] in ("f", "fs") else "none"
            # Ткань — без per-path fill: наследует от группы id="garment".
            if fill != fabric:
                attrs.append(f'fill="{fill}"')
            fo = d.get("fill_opacity")
            if fo is not None and fo < 1 and fill != "none":
                attrs.append(f'fill-opacity="{fmt(fo, 2)}"')
            if d.get("even_odd"):
                attrs.append('fill-rule="evenodd"')
            if d["type"] in ("s", "fs") and d.get("color") is not None:
                attrs.append(f'stroke="{hex_color(d["color"])}"')
                lw = (d.get("width") or 1.0) * PT2MM
                attrs.append(f'stroke-width="{fmt(lw, 2)}"')
                so = d.get("stroke_opacity")
                if so is not None and so < 1:
                    attrs.append(f'stroke-opacity="{fmt(so, 2)}"')
                dashes = d.get("dashes")
                if dashes and dashes != "[] 0":
                    inside = dashes[dashes.find("[") + 1 : dashes.find("]")].strip()
                    if inside:
                        arr = " ".join(
                            fmt(float(x) * PT2MM, 2) for x in inside.split()
                        )
                        attrs.append(f'stroke-dasharray="{arr}"')
                cap = d.get("lineCap")
                if cap and cap[0] == 1:
                    attrs.append('stroke-linecap="round"')
                join = d.get("lineJoin")
                if join == 1:
                    attrs.append('stroke-linejoin="round"')
            path_d = self._path_d(d, ox, oy)
            if not path_d:
                continue
            body.append(f'  <path d="{path_d}" {" ".join(attrs)}/>')

        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(w, 1)} {fmt(h, 1)}" '
            f'width="{fmt(w, 1)}" height="{fmt(h, 1)}">\n'
            f'<g id="garment" fill="{fabric}">\n' + "\n".join(body) + "\n</g>\n</svg>\n"
        )
        info = {"width_mm": round(w, 1), "height_mm": round(h, 1), "fabric": fabric}
        return svg, info

    def anchor_estimate(self) -> dict:
        """Черновые якоря: ось = центр bbox; горловина = самая нижняя точка
        верхней кромки у центра (низ выреза/шов рибаны). Выверяется в /admin."""
        assert self.bbox is not None
        ox, oy = self.bbox.x0 * PT2MM, self.bbox.y0 * PT2MM
        w = self.bbox.width * PT2MM
        cx = w / 2
        band = 12.0  # мм вокруг оси
        top_zone = self.bbox.height * PT2MM * 0.30
        best_y = None
        for d in self.drawings:
            for item in d["items"]:
                pts = []
                if item[0] == "l":
                    pts = [item[1], item[2]]
                elif item[0] == "c":
                    pts = [item[1], item[4]]
                for p in pts:
                    x, y = p.x * PT2MM - ox, p.y * PT2MM - oy
                    if abs(x - cx) <= band and y <= top_zone:
                        if best_y is None or y > best_y:
                            best_y = y
        return {
            "center_axis_x": round(cx, 1),
            "neckline_point": {
                "x": round(cx, 1),
                "y": round(best_y, 1) if best_y is not None else None,
            },
        }


def convert(path: Path, page_no: int, out_dir: Path, prefix: str, decimals: int):
    doc = fitz.open(path)
    page = doc[page_no - 1]
    mid = page.rect.width / 2
    front, back = HalfBuilder(decimals), HalfBuilder(decimals)
    for d in page.get_drawings():
        r = d["rect"]
        if r.width < 0.5 and r.height < 0.5:
            continue
        (front if (r.x0 + r.x1) / 2 < mid else back).add(d)

    out_dir.mkdir(parents=True, exist_ok=True)
    result = {}
    for name, half in (("front", front), ("back", back)):
        svg, info = half.to_svg()
        if "<image" in svg:
            print(f"ВНИМАНИЕ: {name} содержит растр <image> — экспорт будет растровым", file=sys.stderr)
        out = out_dir / f"{prefix}-{name}.svg"
        out.write_text(svg, encoding="utf-8")
        kb = out.stat().st_size / 1024
        if kb > 300:
            print(f"ВНИМАНИЕ: {out.name} {kb:.0f}KB > 300KB — попробуйте --decimals 1", file=sys.stderr)
        result[name] = {
            "file": str(out),
            **info,
            "anchors_estimate": half.anchor_estimate(),
            "size_kb": round(kb, 1),
        }
    print(json.dumps(result, ensure_ascii=False, indent=2))


def previews(path: Path, out_dir: Path):
    doc = fitz.open(path)
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, page in enumerate(doc, 1):
        pix = page.get_pixmap(dpi=12)
        f = out_dir / f"artboard-{i}.png"
        pix.save(f)
        w, h = page.rect.width * PT2MM, page.rect.height * PT2MM
        print(f"артборд {i}: {w:.0f}×{h:.0f} мм → {f}")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("input", type=Path, help="файл визуалки (.ai/.pdf)")
    ap.add_argument("--previews", type=Path, help="каталог для превью всех артбордов")
    ap.add_argument("--page", type=int, help="номер артборда (1-based)")
    ap.add_argument("--out-dir", type=Path, default=Path("public/seed/flats"))
    ap.add_argument("--prefix", default="flat", help="префикс имён файлов (напр. freefit)")
    ap.add_argument("--decimals", type=int, default=1, help="округление координат, знаков")
    args = ap.parse_args()

    if args.previews:
        previews(args.input, args.previews)
        return
    if not args.page:
        ap.error("нужен --page N (или --previews DIR для выбора артборда)")
    convert(args.input, args.page, args.out_dir, args.prefix, args.decimals)


if __name__ == "__main__":
    main()
