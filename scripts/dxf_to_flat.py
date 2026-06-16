#!/usr/bin/env python3
"""
DXF (AAMA, R12) → флэт изделия в мм.

Конвертер лекал PINHEAD. Источник — раскладка деталей в DXF:
  - формат AAMA, DXF R12 (ACADVER AC1006), единицы — миллиметры;
  - каждая деталь каждого размера — отдельный BLOCK с именем `{N}_{size}_{height}_{rev}`,
    напр. `2_M_176_3` = деталь 2 (Перёд), размер M, рост 176;
  - в блоке: внешний контур (линия раскроя, с припуском) + внутренний контур (линия шва,
    готовая деталь) как POLYLINE+VERTEX, долевая нить как LINE, надсечки как TEXT/POINT;
  - детали уложены повёрнутыми: долевая нить горизонтальна (const y), поэтому ось длины
    изделия совпадает с осью X блока. Для прямого флэта деталь поворачиваем в вертикаль.

Соответствие номеров деталей (из аннотаций «Piece Name»):
  1 = Spinka (спина), 2 = Pered (перёд), 3 = Rukav (рукав), 4 = Obtachka (обтачка горловины).

Использование:
  python3 scripts/dxf_to_flat.py <file.dxf> --analyze        # разбор структуры
  python3 scripts/dxf_to_flat.py <file.dxf> --debug 2 M      # геометрия детали 2, размер M
"""
from __future__ import annotations
import sys
import math
from collections import defaultdict

# --- low-level DXF ---------------------------------------------------------

def read_pairs(path: str):
    raw = open(path, encoding="latin-1").read().replace("\r\n", "\n").replace("\r", "\n")
    L = raw.split("\n")
    # DXF — это поток пар (код, значение)
    return [(L[i].strip(), L[i + 1]) for i in range(0, len(L) - 1, 2)]


DETAIL_NAMES = {1: "Spinka", 2: "Pered", 3: "Rukav", 4: "Obtachka"}


def parse_blocks(pairs):
    """Возвращает dict: имя_блока -> {polylines:[[(x,y)..]..], grainline, texts, points}."""
    blocks = {}
    i = 0
    n = len(pairs)
    while i < n:
        c, v = pairs[i]
        if c == "0" and v.strip() == "BLOCK":
            # имя блока — код 2
            name = None
            j = i + 1
            while j < n and pairs[j][0] != "0":
                if pairs[j][0] == "2":
                    name = pairs[j][1].strip()
                j += 1
            # тело до ENDBLK
            k = i + 1
            while k < n and not (pairs[k][0] == "0" and pairs[k][1].strip() == "ENDBLK"):
                k += 1
            blocks[name] = parse_block_body(pairs[i:k])
            i = k
        i += 1
    return blocks


def parse_block_body(sub):
    polylines = []
    grainline = None
    texts = []
    points = []
    i = 0
    n = len(sub)
    while i < n:
        c, v = sub[i]
        v = v.strip()
        if c == "0" and v == "POLYLINE":
            vs = []
            j = i + 1
            while j < n and not (sub[j][0] == "0" and sub[j][1].strip() == "SEQEND"):
                if sub[j][0] == "0" and sub[j][1].strip() == "VERTEX":
                    x = y = None
                    k = j + 1
                    while k < n and sub[k][0] != "0":
                        if sub[k][0] == "10":
                            x = float(sub[k][1])
                        elif sub[k][0] == "20":
                            y = float(sub[k][1])
                        k += 1
                    if x is not None:
                        vs.append((x, y))
                j += 1
            if vs:
                polylines.append(vs)
        elif c == "0" and v == "LINE":
            coords = {}
            j = i + 1
            while j < n and sub[j][0] != "0":
                if sub[j][0] in ("10", "20", "11", "21"):
                    coords[sub[j][0]] = float(sub[j][1])
                j += 1
            if len(coords) == 4:
                grainline = ((coords["10"], coords["20"]), (coords["11"], coords["21"]))
        elif c == "0" and v == "TEXT":
            t = None
            x = y = None
            j = i + 1
            while j < n and sub[j][0] != "0":
                if sub[j][0] == "1":
                    t = sub[j][1].strip()
                elif sub[j][0] == "10":
                    x = float(sub[j][1])
                elif sub[j][0] == "20":
                    y = float(sub[j][1])
                j += 1
            if t:
                texts.append((t, x, y))
        elif c == "0" and v == "POINT":
            x = y = None
            j = i + 1
            while j < n and sub[j][0] != "0":
                if sub[j][0] == "10":
                    x = float(sub[j][1])
                elif sub[j][0] == "20":
                    y = float(sub[j][1])
                j += 1
            if x is not None:
                points.append((x, y))
        i += 1
    return {"polylines": polylines, "grainline": grainline, "texts": texts, "points": points}


# --- геометрия -------------------------------------------------------------

def poly_area(vs):
    a = 0.0
    for i in range(len(vs) - 1):
        x1, y1 = vs[i]
        x2, y2 = vs[i + 1]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0


def bbox(vs):
    xs = [p[0] for p in vs]
    ys = [p[1] for p in vs]
    return min(xs), min(ys), max(xs), max(ys)


def piece_name(block):
    for t, _, _ in block["texts"]:
        if t.startswith("Piece Name:"):
            return t.split(":", 1)[1].strip()
    return None


def contours(block):
    """Внешний (раскрой) и внутренний (шов) контуры по площади. Возвращает (cut, sew)."""
    polys = [p for p in block["polylines"] if len(p) >= 3]
    polys.sort(key=poly_area, reverse=True)
    cut = polys[0] if polys else []
    sew = polys[1] if len(polys) > 1 else cut
    return cut, sew


# --- CLI: анализ -----------------------------------------------------------

SIZES = ["2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"]


def block_name(detail, size):
    return f"{detail}_{size}_176_3"


def cmd_analyze(path):
    pairs = read_pairs(path)
    blocks = parse_blocks(pairs)
    print(f"Блоков: {len(blocks)}")
    for d in (1, 2, 3, 4):
        bn = block_name(d, "M")
        b = blocks.get(bn)
        if not b:
            continue
        cut, sew = contours(b)
        cx0, cy0, cx1, cy1 = bbox(cut)
        print(f"деталь {d} ({DETAIL_NAMES[d]}): {piece_name(b)}")
        print(f"   контур раскроя: {len(cut)} верш, bbox {cx1-cx0:.1f}×{cy1-cy0:.1f} мм")
        print(f"   контур шва:     {len(sew)} верш, grainline={b['grainline']}")


def cmd_debug(path, detail, size):
    pairs = read_pairs(path)
    blocks = parse_blocks(pairs)
    b = blocks[block_name(int(detail), size)]
    cut, sew = contours(b)
    x0, y0, x1, y1 = bbox(sew)
    gl = b["grainline"]
    horizontal = abs(gl[0][1] - gl[1][1]) < abs(gl[0][0] - gl[1][0])
    print(f"деталь {detail} {size}: sew-контур {len(sew)} верш")
    print(f"   bbox(sew) {x1-x0:.1f}(x) × {y1-y0:.1f}(y) мм, grainline horizontal={horizontal}")
    # ось длины = X (т.к. долевая горизонтальна). профиль ширины по X:
    nslices = 12
    print("   профиль полу-ширины по оси длины (X):")
    for s in range(nslices + 1):
        xc = x0 + (x1 - x0) * s / nslices
        band = [p for p in sew if abs(p[0] - xc) <= (x1 - x0) / nslices / 2]
        if band:
            ys = [p[1] for p in band]
            print(f"     x={xc:7.1f}  y[{min(ys):7.1f},{max(ys):7.1f}]  ширина={max(ys)-min(ys):6.1f}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    path = sys.argv[1]
    mode = sys.argv[2]
    if mode == "--analyze":
        cmd_analyze(path)
    elif mode == "--debug":
        cmd_debug(path, sys.argv[3], sys.argv[4])
    else:
        print("неизвестный режим", mode)
