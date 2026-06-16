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

    os.makedirs(FLATS, exist_ok=True)

    # Per-size детали: КАЖДАЯ ростовка в своей системе координат (без force_center),
    # пишем per-size флэт-файл. Возвращаем {tok: piece} и {tok: путь к флэту}.
    def size_pieces(piece, slug):
        out, flats = {}, {}
        for tok, label in SIZES:
            r = process_piece(blocks, piece, label)
            if not r:
                continue
            out[tok] = r
            fn = f"freefit-{slug}-{tok}.svg"
            open(os.path.join(FLATS, fn), "w").write(r["svg"])
            flats[tok] = f"/seed/flats/{fn}"
        return out, flats

    sp_front, sf_front = size_pieces("Pered", "front")
    sp_back, sf_back = size_pieces("Spinka", "back")
    sp_sleeve, sf_sleeve = size_pieces("Rukav", "sleeve")
    bf, bb, bs = sp_front[BASE], sp_back[BASE], sp_sleeve[BASE]
    sa_front = {t: r["anchors"] for t, r in sp_front.items()}
    sa_back = {t: r["anchors"] for t, r in sp_back.items()}
    sa_sleeve = {t: r["anchors"] for t, r in sp_sleeve.items()}

    # Базовые флэты (фоллбэк) = флэт базового размера.
    open(os.path.join(FLATS, "freefit-front.svg"), "w").write(bf["svg"])
    open(os.path.join(FLATS, "freefit-back.svg"), "w").write(bb["svg"])
    open(os.path.join(FLATS, "freefit-sleeve.svg"), "w").write(bs["svg"])

    def rect(x, y, w, h):
        return [[round(x, 1), round(y, 1)], [round(x + w, 1), round(y, 1)],
                [round(x + w, 1), round(y + h, 1)], [round(x, 1), round(y + h, 1)]]

    # Базовые зоны (центр — ось базового размера; в мм, провизорные).
    chest = rect(bf["cx"] - 140, bf["neckline_y"] + 80, 280, 360)
    back_zone = rect(bb["cx"] - 150, bb["neckline_y"] + 90, 300, 400)
    sl_zone = rect(bs["cx"] - 75, bs["h"] * 0.22, 150, 95)

    # Per-size зоны: центр — ось КАЖДОГО размера, масштаб по габаритам детали.
    def front_back_zones(base_piece, sp, zw, zh, top_off, area_id, area_name):
        out = {}
        for tok, r in sp.items():
            sw = zw * (r["w"] / base_piece["w"])
            sh = zh * (r["h"] / base_piece["h"])
            out[tok] = [{"id": area_id, "name": area_name,
                         "polygon_mm": rect(r["cx"] - sw / 2, r["neckline_y"] + top_off, sw, sh),
                         "safe_inset_mm": 20}]
        return out

    def sleeve_zones(base_piece, sp, zw, zh):
        out = {}
        for tok, r in sp.items():
            sw = zw * (r["w"] / base_piece["w"])
            sh = zh * (r["h"] / base_piece["h"])
            out[tok] = [{"id": "sleeve", "name": "Рукав",
                         "polygon_mm": rect(r["cx"] - sw / 2, r["h"] * 0.22, sw, sh),
                         "safe_inset_mm": 12}]
        return out

    spa_front = front_back_zones(bf, sp_front, 280, 360, 80, "chest", "Грудь")
    spa_back = front_back_zones(bb, sp_back, 300, 400, 90, "back", "Спина")
    spa_sleeve = sleeve_zones(bs, sp_sleeve, 150, 95)

    # Этикетка на спине (демо мультизоны): малая зона под горловиной каждого размера.
    back_label = rect(bb["cx"] - 40, bb["neckline_y"] + 12, 80, 35)
    for tok, r in sp_back.items():
        lw = 80 * (r["w"] / bb["w"])
        spa_back[tok] = [spa_back[tok][0], {"id": "label", "name": "Этикетка",
                         "polygon_mm": rect(r["cx"] - lw / 2, r["neckline_y"] + 12, lw, 35),
                         "safe_inset_mm": 6}]

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
                "size_flats": sf_front,
                "scale_mm_per_unit": 1,
                "anchors": bf["anchors"], "size_anchors": sa_front,
                "print_areas": [{"id": "chest", "name": "Грудь",
                                 "polygon_mm": chest, "safe_inset_mm": 20}],
                "size_print_areas": spa_front,
            },
            {
                "id": "freefit-back", "kind": "back",
                "flat_svg": "/seed/flats/freefit-back.svg",
                "size_flats": sf_back,
                "scale_mm_per_unit": 1,
                "anchors": bb["anchors"], "size_anchors": sa_back,
                "print_areas": [
                    {"id": "back", "name": "Спина",
                     "polygon_mm": back_zone, "safe_inset_mm": 20},
                    {"id": "label", "name": "Этикетка",
                     "polygon_mm": back_label, "safe_inset_mm": 6},
                ],
                "size_print_areas": spa_back,
            },
            {
                "id": "freefit-sleeve-left", "kind": "sleeve_left",
                "flat_svg": "/seed/flats/freefit-sleeve.svg",
                "size_flats": sf_sleeve,
                "scale_mm_per_unit": 1,
                "anchors": bs["anchors"], "size_anchors": sa_sleeve,
                "print_areas": [{"id": "sleeve", "name": "Рукав",
                                 "polygon_mm": sl_zone, "safe_inset_mm": 12}],
                "size_print_areas": spa_sleeve,
            },
            {
                "id": "freefit-sleeve-right", "kind": "sleeve_right",
                "flat_svg": "/seed/flats/freefit-sleeve.svg",
                "size_flats": sf_sleeve,
                "scale_mm_per_unit": 1,
                "anchors": bs["anchors"], "size_anchors": sa_sleeve,
                "print_areas": [{"id": "sleeve", "name": "Рукав",
                                 "polygon_mm": sl_zone, "safe_inset_mm": 12}],
                "size_print_areas": spa_sleeve,
            },
        ],
    }

    cat = json.load(open(SKUS, encoding="utf-8"))
    cat["skus"] = [s for s in cat["skus"] if s["id"] != "tshirt-freefit"]
    cat["skus"].append(sku)
    json.dump(cat, open(SKUS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"front base: {bf['w']}×{bf['h']} мм cx={bf['cx']}; per-size флэты: {len(sf_front)}")
    print(f"front w по размерам: " + ", ".join(f"{t}={sp_front[t]['w']}" for t in sizes))
    print(f"добавлен SKU tshirt-freefit; per-size флэты в public/seed/flats/")


if __name__ == "__main__":
    main(sys.argv[1])
