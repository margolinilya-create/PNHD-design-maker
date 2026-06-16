#!/usr/bin/env python3
"""DXF-выкройка → флэт SVG в мм + якоря (для лекальной базы PINHEAD).

Берёт деталь (Pered/Spinka/Rukav) нужного размера, ориентирует по долевой нити
(grainline) вертикально, нормализует в мм, считает якоря (горловина/центр или
низ рукава/центр). Печатает отладку; по --emit пишет SVG и JSON-якоря.

Usage:
  python3 scripts/dxf_to_flat.py <file.dxf> <piece:Pered|Spinka|Rukav> <size> [--emit out.svg]
"""
import sys
import math


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


def parse_blocks(pairs):
    blocks = {}
    cur_block = None
    cur_type = None
    open_poly = None
    line = None
    pend_text = None

    def ensure(n):
        return blocks.setdefault(n, {"polys": [], "lines": [], "texts": []})

    for code, val in pairs:
        if code == 0:
            v = val.strip()
            if v == "SEQEND" and open_poly is not None and cur_block:
                ensure(cur_block)["polys"].append(open_poly)
                open_poly = None
            if cur_type == "LINE" and line and cur_block:
                ensure(cur_block)["lines"].append(line)
                line = None
            cur_type = v
            if v == "BLOCK":
                cur_block = "?"
            elif v == "ENDBLK":
                cur_block = None
            elif v == "POLYLINE":
                open_poly = {"layer": None, "pts": []}
            elif v == "LINE":
                line = {"layer": None}
            elif v == "TEXT":
                pend_text = {"s": None}
        elif code == 2 and cur_type == "BLOCK":
            cur_block = val.strip(); ensure(cur_block)
        elif code == 8:
            if cur_type == "POLYLINE" and open_poly and open_poly["layer"] is None:
                open_poly["layer"] = val.strip()
            if cur_type == "LINE" and line:
                line["layer"] = val.strip()
        elif code == 10:
            x = _f(val)
            if x is None: continue
            if cur_type == "VERTEX" and open_poly is not None:
                open_poly["_x"] = x
            elif cur_type == "LINE" and line is not None:
                line["x1"] = x
        elif code == 20:
            y = _f(val)
            if y is None: continue
            if cur_type == "VERTEX" and open_poly is not None and "_x" in open_poly:
                open_poly["pts"].append((open_poly["_x"], y))
            elif cur_type == "LINE" and line is not None:
                line["y1"] = y
        elif code == 11 and cur_type == "LINE" and line is not None:
            line["x2"] = _f(val)
        elif code == 21 and cur_type == "LINE" and line is not None:
            line["y2"] = _f(val)
        elif code == 1 and pend_text is not None and cur_block:
            ensure(cur_block)["texts"].append(val.strip()); pend_text = None
    return blocks


def _f(v):
    try: return float(v)
    except ValueError: return None


def find_block(blocks, piece, size):
    for name, b in blocks.items():
        pn = next((t for t in b["texts"] if "Piece Name" in t), "")
        sz = next((t for t in b["texts"] if t.startswith("Size")), "")
        if piece.lower() in pn.lower() and size.lower() in sz.lower():
            return name, b
    return None, None


def boundary(b):
    cands = [p for p in b["polys"] if len(p["pts"]) >= 3]
    def area(p):
        xs=[q[0] for q in p["pts"]]; ys=[q[1] for q in p["pts"]]
        return (max(xs)-min(xs))*(max(ys)-min(ys))
    return max(cands, key=area)["pts"]


def grainline(b):
    """Самая длинная LINE детали — долевая нить."""
    best=None; bl=-1
    for l in b["lines"]:
        if None in (l.get("x1"),l.get("y1"),l.get("x2"),l.get("y2")): continue
        d=math.hypot(l["x2"]-l["x1"], l["y2"]-l["y1"])
        if d>bl: bl=d; best=l
    return best


def rot(pts, theta, ox, oy):
    c,s=math.cos(theta),math.sin(theta)
    return [((x-ox)*c-(y-oy)*s, (x-ox)*s+(y-oy)*c) for x,y in pts]


def process_piece(blocks, piece, size, force_center=None):
    """Вернуть {svg, anchors, w, h, cx, neckline_y, is_sleeve} для детали размера."""
    name, b = find_block(blocks, piece, size)
    if not b:
        return None
    pts = boundary(b); gl = grainline(b)
    ang = math.atan2(gl["y2"]-gl["y1"], gl["x2"]-gl["x1"]) if gl else math.pi/2
    theta = math.pi/2 - ang
    glx = (gl["x1"]+gl["x2"])/2 if gl else 0
    gly = (gl["y1"]+gl["y2"])/2 if gl else 0
    P = rot(pts, theta, glx, gly)
    G = rot([(gl["x1"],gl["y1"]),(gl["x2"],gl["y2"])], theta, glx, gly) if gl else [(0,0),(0,1)]
    xs=[p[0] for p in P]; ys=[p[1] for p in P]
    minx,maxx,miny,maxy=min(xs),max(xs),min(ys),max(ys)
    w,h = maxx-minx, maxy-miny
    N=[(x-minx, y-miny) for x,y in P]
    cx = G[0][0]-minx
    is_sleeve = "rukav" in piece.lower()

    def scoop(top):
        band=[(x,y) for x,y in N if abs(x-cx)<0.18*w and (y<h*0.5 if top else y>h*0.5)]
        if not band: return 0
        if top:
            ext=min(y for _,y in N); dip=max(y for _,y in band); return dip-ext
        ext=max(y for _,y in N); dip=min(y for _,y in band); return ext-dip
    if scoop(True) < scoop(False):
        N=[(x, h-y) for x,y in N]

    if is_sleeve:
        anchors={"sleeve_bottom_y": round(h,1), "sleeve_center_x": round(cx,1)}
        neckline_y=None
    else:
        band=[(x,y) for x,y in N if abs(x-cx)<0.18*w and y<h*0.5]
        neckline_y = round(max(y for _,y in band),1) if band else 0.0
        ax = round(force_center if force_center is not None else cx,1)
        anchors={"neckline_point":{"x":ax,"y":neckline_y},"center_axis_x":ax}

    d="M "+" L ".join(f"{x:.1f},{y:.1f}" for x,y in N)+" Z"
    svg=(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
         f'width="{w:.0f}" height="{h:.0f}">\n'
         f'  <path id="garment" d="{d}" fill="#1b1f24" stroke="#5b6470" '
         f'stroke-width="3" stroke-linejoin="round"/>\n'
         f'  <line id="center-axis" x1="{cx:.1f}" y1="0" x2="{cx:.1f}" y2="{h:.0f}" '
         f'stroke="#3b4350" stroke-width="1.5" stroke-dasharray="6 8"/>\n')
    if is_sleeve:
        svg+=f'  <line id="sleeve-bottom" x1="0" y1="{h:.0f}" x2="{w:.0f}" y2="{h:.0f}" stroke="#ff5a5f" stroke-width="3"/>\n'
    else:
        svg+=f'  <circle id="neckline-point" cx="{anchors["neckline_point"]["x"]}" cy="{anchors["neckline_point"]["y"]}" r="6" fill="#ff5a5f"/>\n'
    svg+="</svg>\n"
    return {"svg":svg,"anchors":anchors,"w":round(w,1),"h":round(h,1),
            "cx":round(cx,1),"neckline_y":neckline_y,"is_sleeve":is_sleeve,"block":name}


def main():
    path,piece,size = sys.argv[1],sys.argv[2],sys.argv[3]
    emit = sys.argv[sys.argv.index("--emit")+1] if "--emit" in sys.argv else None
    blocks = parse_blocks(read_pairs(path))
    name,b = find_block(blocks,piece,size)
    if not b: print("piece not found"); return
    pts = boundary(b); gl = grainline(b)
    # Угол долевой → вертикаль.
    ang = math.atan2(gl["y2"]-gl["y1"], gl["x2"]-gl["x1"]) if gl else math.pi/2
    theta = math.pi/2 - ang
    glx = (gl["x1"]+gl["x2"])/2 if gl else 0
    gly = (gl["y1"]+gl["y2"])/2 if gl else 0
    P = rot(pts, theta, glx, gly)
    G = rot([(gl["x1"],gl["y1"]),(gl["x2"],gl["y2"])], theta, glx, gly) if gl else [(0,0),(0,1)]
    # SVG: y вниз. Нормализуем в [0..w]x[0..h].
    xs=[p[0] for p in P]; ys=[p[1] for p in P]
    minx,maxx,miny,maxy=min(xs),max(xs),min(ys),max(ys)
    w,h = maxx-minx, maxy-miny
    N=[(x-minx, y-miny) for x,y in P]
    cx = G[0][0]-minx  # x долевой (центр)
    is_sleeve = "rukav" in piece.lower()
    # Определить, где горловина/верх: ищем «вырез» у центра на каждом конце.
    def scoop(top):
        band=[(x,y) for x,y in N if abs(x-cx)<0.18*w and (y<h*0.5 if top else y>h*0.5)]
        if not band: return 0
        if top:
            ext=min(y for _,y in N if True)  # верхняя точка
            dip=max(y for _,y in band)       # самая «провисшая» у центра
            return dip-ext
        else:
            ext=max(y for _,y in N)
            dip=min(y for _,y in band)
            return ext-dip
    flip = scoop(True) < scoop(False)  # горловина должна быть сверху
    if flip:
        N=[(x, h-y) for x,y in N]
    # Якоря.
    if is_sleeve:
        # низ рукава = нижний край (max y), центр = долевая.
        anchors = {"sleeve_bottom_y": round(h,1), "sleeve_center_x": round(cx,1)}
    else:
        band=[(x,y) for x,y in N if abs(x-cx)<0.18*w and y<h*0.5]
        neck_y = max(y for _,y in band) if band else 0
        anchors = {"neckline_point": {"x": round(cx,1), "y": round(neck_y,1)},
                   "center_axis_x": round(cx,1)}
    print(f"block={name}")
    print(f"grain angle={math.degrees(ang):.1f}°  flip={flip}")
    print(f"size mm: w={w:.1f} h={h:.1f}  center_x={cx:.1f}")
    print(f"anchors={anchors}")
    # SVG path.
    d="M "+" L ".join(f"{x:.1f},{y:.1f}" for x,y in N)+" Z"
    svg=(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
         f'width="{w:.0f}" height="{h:.0f}">\n'
         f'  <path id="garment" d="{d}" fill="#1b1f24" stroke="#5b6470" '
         f'stroke-width="3" stroke-linejoin="round"/>\n'
         f'  <line id="center-axis" x1="{cx:.1f}" y1="0" x2="{cx:.1f}" y2="{h:.0f}" '
         f'stroke="#3b4350" stroke-width="1.5" stroke-dasharray="6 8"/>\n')
    if is_sleeve:
        svg+=f'  <line id="sleeve-bottom" x1="0" y1="{h:.0f}" x2="{w:.0f}" y2="{h:.0f}" stroke="#ff5a5f" stroke-width="3"/>\n'
    else:
        svg+=f'  <circle id="neckline-point" cx="{anchors["neckline_point"]["x"]}" cy="{anchors["neckline_point"]["y"]}" r="6" fill="#ff5a5f"/>\n'
    svg+="</svg>\n"
    if emit:
        with open(emit,"w") as f: f.write(svg)
        print(f"wrote {emit}")


if __name__ == "__main__":
    main()
