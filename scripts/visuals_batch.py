#!/usr/bin/env python3
"""Пакетная сборка seed-каталога из фирменных визуалок (.ai, 1:1).

Вход — JSON-конфиг вида:
{
  "visuals_dir": "path/to/ai",
  "out_flats": "public/seed/flats",
  "categories": [
    { "slug": "bomber", "type": "bomber", "name_ru": "Бомбер",
      "file": "bomber.ai",
      "fits": [ {"page": 1, "fit": "Зип", "fit_slug": "zip"}, … ] }
  ]
}

Каждый (категория × посадка) → SKU: 1–2 вида (перёд/спина) по колонкам
артборда (разрывы по X ≥ gap_mm), флэты в конвенции flat-svg-convention
(viewBox в мм, ткань в <g id="garment">), черновые якоря и провизорная
центральная зона (клампится в силуэт — правится в /admin).

Печатает JSON: skus[] для вставки в public/seed/skus.json.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from visual_to_flat import PT2MM, HalfBuilder  # noqa: E402

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    sys.exit("Нужен PyMuPDF: pip install pymupdf")

PAD_MM = 3  # раздутие bbox при проверке связности (ленты над воротом мостят виды при большем)
MIN_H_RATIO = 0.45  # компонент-изделие ≥ 45% высоты крупнейшего
MIN_AREA_RATIO = 0.12  # и ≥ 12% его площади (отсев рукавов-деталей)


def split_views(page, expected: int, decimals: int) -> list[HalfBuilder]:
    """Виды артборда = связные компоненты элементов.

    1) Берём только элементы ВНУТРИ MediaBox — Illustrator сохраняет в поток
       страницы и закадровый мусор (паспорта/линейки), который клипится при
       рендере, но приходит из get_drawings().
    2) Union-Find по пересечению bbox (с зазором PAD_MM) — рукава изделия
       пересекают тело, отдельно лежащие детали и штампы не пересекают.
    3) «Изделия» = компоненты, сопоставимые с крупнейшим по высоте и площади;
       сорт по X, отдаём первые `expected` (перёд, спина).
    """
    pr = page.rect
    drawings = []
    for d in page.get_drawings():
        r = d["rect"]
        if r.width < 0.5 and r.height < 0.5:
            continue
        cx, cy = (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2
        if not (pr.x0 <= cx <= pr.x1 and pr.y0 <= cy <= pr.y1):
            continue  # закадровый объект
        drawings.append(d)
    if not drawings:
        return []

    pad = PAD_MM / PT2MM
    parent = list(range(len(drawings)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int):
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[ri] = rj

    rects = [d["rect"] for d in drawings]
    for i in range(len(rects)):
        a = rects[i]
        for j in range(i + 1, len(rects)):
            b = rects[j]
            if (
                a.x0 - pad <= b.x1
                and b.x0 - pad <= a.x1
                and a.y0 - pad <= b.y1
                and b.y0 - pad <= a.y1
            ):
                union(i, j)

    groups: dict[int, HalfBuilder] = {}
    for i, d in enumerate(drawings):
        groups.setdefault(find(i), HalfBuilder(decimals)).add(d)

    comps = list(groups.values())
    max_h = max(c.bbox.height for c in comps)
    max_area = max(c.bbox.width * c.bbox.height for c in comps)
    views = [
        c
        for c in comps
        if c.bbox.height >= MIN_H_RATIO * max_h
        and c.bbox.width * c.bbox.height >= MIN_AREA_RATIO * max_area
    ]
    views.sort(key=lambda c: c.bbox.x0)
    return views[: max(1, expected)]


def provisional_zone(w: float, h: float, neck_y: float | None, cx: float):
    """Провизорная центральная зона печати, клампится в силуэт."""
    zw = min(320, round(w * 0.45 / 10) * 10)
    zh = min(400, round(h * 0.5 / 10) * 10)
    top = (neck_y if neck_y is not None else h * 0.2) + 60
    top = max(15, min(top, h - zh - 15))
    x = round(cx - zw / 2, 1)
    y = round(top, 1)
    return {
        "polygon": [[x, y], [x + zw, y], [x + zw, y + zh], [x, y + zh]],
        "safe": 20 if min(zw, zh) >= 120 else 10,
    }


def convert_sku(page, cat: dict, fit: dict, out_dir: Path, decimals: int):
    # board_views — сколько видов на артборде (по превью); берём первые 1-2.
    expected = cat.get("board_views", 2)
    cols = split_views(page, expected, decimals)
    if not cols:
        raise RuntimeError(f"{cat['slug']}-{fit['fit_slug']}: пустой артборд")
    kinds = ["front", "back"][: min(2, len(cols))]
    sku_id = f"{cat['slug']}-{fit['fit_slug']}"
    views = []
    for kind, col in zip(kinds, cols):
        svg, info = col.to_svg()
        fname = f"{sku_id}-{kind}.svg"
        (out_dir / fname).write_text(svg, encoding="utf-8")
        est = col.anchor_estimate()
        w, h = info["width_mm"], info["height_mm"]
        cx = est["center_axis_x"]
        neck_y = est["neckline_point"]["y"]
        zone = provisional_zone(w, h, neck_y, cx)
        views.append(
            {
                "id": f"{sku_id}-{kind}",
                "kind": kind,
                "flat_svg": f"/seed/flats/{fname}",
                "scale_mm_per_unit": 1,
                "anchors": {
                    "neckline_point": {
                        "x": cx,
                        # Черновая оценка; None не бывает валидным → фоллбэк.
                        "y": neck_y if neck_y is not None else round(h * 0.1, 1),
                    },
                    "center_axis_x": cx,
                },
                "print_areas": [
                    {
                        "id": kind,
                        "name": "Перёд" if kind == "front" else "Спина",
                        "polygon_mm": zone["polygon"],
                        "safe_inset_mm": zone["safe"],
                    }
                ],
            }
        )
    return {
        "id": sku_id,
        "name": f"{cat['name_ru']} {fit['fit']}",
        "type": cat["type"],
        "product_kind": "finished",
        "base_size": "M",
        "sizes": ["M"],
        "views": views,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("config", type=Path)
    ap.add_argument("--decimals", type=int, default=1)
    args = ap.parse_args()

    cfg = json.loads(args.config.read_text(encoding="utf-8"))
    visuals = Path(cfg["visuals_dir"])
    out_dir = Path(cfg["out_flats"])
    out_dir.mkdir(parents=True, exist_ok=True)

    skus = []
    for cat in cfg["categories"]:
        doc = fitz.open(visuals / cat["file"])
        for fit in cat["fits"]:
            page = doc[fit["page"] - 1]
            sku = convert_sku(page, cat, fit, out_dir, args.decimals)
            skus.append(sku)
            fl = ", ".join(
                f"{v['kind']} {Path(v['flat_svg']).name}" for v in sku["views"]
            )
            print(f"✓ {sku['id']}: {fl}", file=sys.stderr)
    print(json.dumps({"skus": skus}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
