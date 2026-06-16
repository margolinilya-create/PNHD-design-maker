#!/usr/bin/env python3
"""Собрать реальный SKU из DXF-выкройки: флэты (база) + per-size якоря + зоны.

Эмитит SVG-флэты базового размера в public/seed/flats/ и добавляет запись SKU
в public/seed/skus.json (печатные зоны — провизорные, уточняются в редакторе).

Usage: python3 scripts/dxf_build_sku.py <file.dxf>
"""
import sys, json, os
from dxf_to_flat import read_pairs, parse_blocks, process_piece

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLATS = os.path.join(ROOT, "public/seed/flats")
SKUS = os.path.join(ROOT, "public/seed/skus.json")

# токен → метка размера в DXF
SIZES = [("2XS","2XS-176"),("XS","XS-176"),("S","S-176"),("M","M-176"),
         ("L","L-176"),("XL","XL-176"),("2XL","2XL-176"),("3XL","3XL-176"),
         ("4XL","4XL-176")]
BASE = "M"


def main(dxf):
    blocks = parse_blocks(read_pairs(dxf))
    base_label = dict(SIZES)[BASE]

    # Базовые детали (для флэта и центральных осей).
    bf = process_piece(blocks, "Pered", base_label)
    bb = process_piece(blocks, "Spinka", base_label)
    bs = process_piece(blocks, "Rukav", base_label)
    front_cx, back_cx, sleeve_cx = bf["cx"], bb["cx"], bs["cx"]

    os.makedirs(FLATS, exist_ok=True)
    open(os.path.join(FLATS, "freefit-front.svg"), "w").write(bf["svg"])
    open(os.path.join(FLATS, "freefit-back.svg"), "w").write(bb["svg"])
    open(os.path.join(FLATS, "freefit-sleeve.svg"), "w").write(bs["svg"])

    # Per-size якоря (ось центра — константа базового размера).
    def size_anchors(piece, cx):
        out = {}
        for tok, label in SIZES:
            r = process_piece(blocks, piece, label, force_center=cx)
            if r:
                out[tok] = r["anchors"]
        return out

    sa_front = size_anchors("Pered", front_cx)
    sa_back = size_anchors("Spinka", back_cx)
    sa_sleeve = size_anchors("Rukav", sleeve_cx)

    # Печатные зоны (провизорные, в мм; уточняются в редакторе).
    def rect(x, y, w, h):
        return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]

    chest = rect(front_cx - 140, bf["neckline_y"] + 80, 280, 360)
    back_zone = rect(back_cx - 150, bb["neckline_y"] + 90, 300, 400)
    sl_zone = rect(sleeve_cx - 75, bs["h"] * 0.22, 150, 95)

    sizes = [t for t, _ in SIZES]
    sku = {
        "id": "tshirt-freefit",
        "name": "Футболка FreeFit (oversized)",
        "type": "tshirt",
        "base_size": BASE,
        "sizes": sizes,
        "views": [
            {
                "id": "freefit-front", "kind": "front",
                "flat_svg": "/seed/flats/freefit-front.svg",
                "scale_mm_per_unit": 1,
                "anchors": bf["anchors"], "size_anchors": sa_front,
                "print_areas": [{"id": "chest", "name": "Грудь",
                                 "polygon_mm": chest, "safe_inset_mm": 20}],
            },
            {
                "id": "freefit-back", "kind": "back",
                "flat_svg": "/seed/flats/freefit-back.svg",
                "scale_mm_per_unit": 1,
                "anchors": bb["anchors"], "size_anchors": sa_back,
                "print_areas": [{"id": "back", "name": "Спина",
                                 "polygon_mm": back_zone, "safe_inset_mm": 20}],
            },
            {
                "id": "freefit-sleeve-left", "kind": "sleeve_left",
                "flat_svg": "/seed/flats/freefit-sleeve.svg",
                "scale_mm_per_unit": 1,
                "anchors": bs["anchors"], "size_anchors": sa_sleeve,
                "print_areas": [{"id": "sleeve", "name": "Рукав",
                                 "polygon_mm": sl_zone, "safe_inset_mm": 12}],
            },
        ],
    }

    cat = json.load(open(SKUS, encoding="utf-8"))
    cat["skus"] = [s for s in cat["skus"] if s["id"] != "tshirt-freefit"]
    cat["skus"].append(sku)
    json.dump(cat, open(SKUS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"front: {bf['w']}×{bf['h']} мм, neckline_y={bf['neckline_y']}, cx={front_cx}")
    print(f"back:  {bb['w']}×{bb['h']} мм, neckline_y={bb['neckline_y']}, cx={back_cx}")
    print(f"sleeve:{bs['w']}×{bs['h']} мм, bottom_y={bs['h']}, cx={sleeve_cx}")
    print(f"front neckline_y по размерам: "
          + ", ".join(f"{t}={sa_front[t]['neckline_point']['y']}" for t in sizes))
    print(f"добавлен SKU tshirt-freefit; флэты в public/seed/flats/")


if __name__ == "__main__":
    main(sys.argv[1])
