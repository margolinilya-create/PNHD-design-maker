#!/usr/bin/env python3
"""Анализ DXF-выкройки (R12/AAMA) по блокам-деталям.

Группирует сущности по BLOCK, собирает boundary-полилинии (layer 1),
подписи (Piece Name / Size), считает габариты детали в единицах чертежа (мм).

Usage: python3 scripts/dxf_analyze.py <file.dxf>
"""
import sys


def read_pairs(path):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        lines = [ln.rstrip("\n").rstrip("\r") for ln in f]
    out = []
    for i in range(0, len(lines) - 1, 2):
        try:
            code = int(lines[i].strip())
        except ValueError:
            continue
        out.append((code, lines[i + 1]))
    return out


def main(path):
    pairs = read_pairs(path)
    blocks = {}            # name -> dict
    cur_block = None
    cur_type = None
    cur_layer = None
    open_poly = None       # {layer, pts:[(x,y)]}
    pend_text = None       # текущий TEXT (ждём code 1)

    def ensure(name):
        if name not in blocks:
            blocks[name] = {"polys": [], "texts": [], "name": name}
        return blocks[name]

    for code, val in pairs:
        if code == 0:
            v = val.strip()
            # Закрыть открытую полилинию по SEQEND.
            if v == "SEQEND" and open_poly is not None and cur_block:
                ensure(cur_block)["polys"].append(open_poly)
                open_poly = None
            cur_type = v
            if v == "BLOCK":
                cur_block = "?"  # имя придёт в code 2
            elif v == "ENDBLK":
                cur_block = None
            elif v == "POLYLINE":
                open_poly = {"layer": None, "pts": []}
            elif v == "VERTEX":
                pass
            elif v == "TEXT":
                pend_text = {"layer": cur_layer, "s": None}
        elif code == 2 and cur_type == "BLOCK":
            cur_block = val.strip()
            ensure(cur_block)
        elif code == 8:
            cur_layer = val.strip()
            if cur_type == "POLYLINE" and open_poly is not None and open_poly["layer"] is None:
                open_poly["layer"] = cur_layer
        elif code == 10:
            try:
                x = float(val)
            except ValueError:
                continue
            if cur_type == "VERTEX" and open_poly is not None:
                open_poly.setdefault("_x", x)
                open_poly["_x"] = x
        elif code == 20:
            try:
                y = float(val)
            except ValueError:
                continue
            if cur_type == "VERTEX" and open_poly is not None and "_x" in open_poly:
                open_poly["pts"].append((open_poly["_x"], y))
        elif code == 1 and pend_text is not None:
            pend_text["s"] = val.strip()
            if cur_block:
                ensure(cur_block)["texts"].append(pend_text)
            pend_text = None

    # Сводка по блокам.
    print(f"BLOCKS: {len(blocks)}\n")
    rows = []
    for name, b in blocks.items():
        # boundary = самая большая полилиния на layer '1'
        cands = [p for p in b["polys"] if p["pts"]]
        if not cands:
            continue
        def bbox(p):
            xs = [q[0] for q in p["pts"]]; ys = [q[1] for q in p["pts"]]
            return min(xs), min(ys), max(xs), max(ys)
        def area(p):
            x0, y0, x1, y1 = bbox(p)
            return (x1 - x0) * (y1 - y0)
        main_poly = max(cands, key=area)
        x0, y0, x1, y1 = bbox(main_poly)
        piece = next((t["s"] for t in b["texts"] if t["s"] and "Piece Name" in t["s"]), "")
        size = next((t["s"] for t in b["texts"] if t["s"] and t["s"].startswith("Size")), "")
        rows.append({
            "name": name, "w": x1 - x0, "h": y1 - y0, "x0": x0, "y0": y0,
            "npts": len(main_poly["pts"]), "layer": main_poly["layer"],
            "piece": piece.replace("Piece Name:", "").strip(),
            "size": size.replace("Size:", "").strip(),
        })

    for r in sorted(rows, key=lambda r: (r["size"], r["piece"]))[:60]:
        print(f"  blk={r['name'][:10]:10} sz={r['size'][:8]:8} "
              f"w={r['w']:7.1f} h={r['h']:7.1f} pts={r['npts']:3} "
              f"L{str(r['layer'])} {r['piece'][:46]}")

    # Уникальные детали и размеры.
    pieces = sorted(set(r["piece"] for r in rows if r["piece"]))
    sizes = sorted(set(r["size"] for r in rows if r["size"]))
    print(f"\nUNIQUE PIECES ({len(pieces)}):")
    for p in pieces:
        print("   ", p)
    print(f"\nUNIQUE SIZES ({len(sizes)}): {sizes}")


if __name__ == "__main__":
    main(sys.argv[1])
