"use client";

import { Group, Line, Rect, Arrow, Text } from "react-konva";
import {
  placementInfo,
  anchorsForSize,
  printAreasForSize,
} from "@/lib/geometry/view";
import type { Zone } from "@/lib/geometry/coords";
import type { Placement, View } from "@/types";
import type { Transform } from "./canvasTransform";

/** Тонкая сетка с шагом 50 мм в пределах печатной зоны. */
export function GridLines({ zone, t }: { zone: Zone; t: Transform }) {
  const step = 50; // мм
  const lines: React.ReactNode[] = [];
  const x0 = zone.zx;
  const x1 = zone.zx + zone.zw;
  const y0 = zone.zy;
  const y1 = zone.zy + zone.zh;
  const color = "rgba(148,163,184,0.18)"; // приглушённый серо-голубой
  // Вертикали, кратные шагу.
  const startX = Math.ceil(x0 / step) * step;
  for (let x = startX; x <= x1; x += step) {
    lines.push(
      <Line
        key={`v${x}`}
        points={[t.px(x), t.py(y0), t.px(x), t.py(y1)]}
        stroke={color}
        strokeWidth={1}
      />,
    );
  }
  // Горизонтали.
  const startY = Math.ceil(y0 / step) * step;
  for (let y = startY; y <= y1; y += step) {
    lines.push(
      <Line
        key={`h${y}`}
        points={[t.px(x0), t.py(y), t.px(x1), t.py(y)]}
        stroke={color}
        strokeWidth={1}
      />,
    );
  }
  return <>{lines}</>;
}

export function ZoneShapes({
  view,
  t,
  size,
}: {
  view: View;
  t: Transform;
  size?: string;
}) {
  return (
    <>
      {printAreasForSize(view, size).map((area) => {
        const pts = area.polygon_mm.flatMap((pt) => [t.px(pt[0]), t.py(pt[1])]);
        // safe-zone — прямоугольный inset по AABB полигона.
        const xs = area.polygon_mm.map((p) => p[0]);
        const ys = area.polygon_mm.map((p) => p[1]);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const inset = area.safe_inset_mm;
        return (
          <Group key={area.id}>
            <Line
              points={pts}
              closed
              stroke="#2563eb"
              strokeWidth={1.5}
              dash={[8, 6]}
              fill="rgba(37,140,235,0.05)"
            />
            <Rect
              x={t.px(minX + inset)}
              y={t.py(minY + inset)}
              width={t.s(maxX - minX - 2 * inset)}
              height={t.s(maxY - minY - 2 * inset)}
              stroke="#16a34a"
              strokeWidth={1}
              dash={[4, 4]}
            />
          </Group>
        );
      })}
    </>
  );
}

/** Именованные вертикальные оси (выточки/рельефы): пунктир + подпись. */
export function NamedAxesGuides({
  view,
  t,
  size,
  flatH,
}: {
  view: View;
  t: Transform;
  size?: string;
  flatH: number;
}) {
  const anchors = size ? anchorsForSize(view, size) : view.anchors;
  const axes = anchors.axes ?? [];
  if (!axes.length) return null;
  return (
    <>
      {axes.map((a) => (
        <Group key={a.id}>
          <Line
            points={[t.px(a.x), t.py(0), t.px(a.x), t.py(flatH)]}
            stroke="#7c3aed"
            strokeWidth={0.8}
            dash={[6, 6]}
            opacity={0.7}
          />
          <Text
            x={t.px(a.x) + 3}
            y={t.py(0) + 4}
            text={a.name}
            fontSize={11}
            fill="#7c3aed"
          />
        </Group>
      ))}
    </>
  );
}

export function DimensionOverlay({
  placement: p,
  view,
  t,
  garmentSize,
}: {
  placement: Placement;
  view: View;
  t: Transform;
  garmentSize: string | null;
}) {
  const info = placementInfo(
    view,
    { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
    p.rotation_deg,
    garmentSize ?? undefined,
    p.print_area_id,
  );
  const { aabb, zone, dimensions: d, anchor } = info;
  const midX = aabb.x + aabb.w / 2;
  const midY = aabb.y + aabb.h / 2;
  const color = "#94a3b8";

  // Числовая подпись с белой полупрозрачной подложкой (halo) —
  // читаемость на светлом холсте/макете.
  const label = (
    x: number,
    y: number,
    text: string,
    fill = "#475569",
  ) => {
    const w = 48;
    const cx = t.px(x);
    const cy = t.py(y);
    const haloW = Math.min(w, text.length * 8 + 8);
    return (
      <Group key={`lbl-${x}-${y}-${text}`}>
        <Rect
          x={cx - haloW / 2}
          y={cy - 8}
          width={haloW}
          height={16}
          cornerRadius={3}
          fill="rgba(255,255,255,0.85)"
        />
        <Text
          x={cx - w / 2}
          y={cy - 7}
          width={w}
          align="center"
          text={text}
          fontSize={11}
          fill={fill}
        />
      </Group>
    );
  };

  const arrow = (x1: number, y1: number, x2: number, y2: number) => (
    <Arrow
      points={[t.px(x1), t.py(y1), t.px(x2), t.py(y2)]}
      pointerAtBeginning
      pointerLength={5}
      pointerWidth={5}
      stroke={color}
      fill={color}
      strokeWidth={1}
    />
  );

  // Якорь центра/горловины (по якорям текущего размера).
  const sizeAnchors = garmentSize
    ? anchorsForSize(view, garmentSize)
    : view.anchors;
  const centerX =
    anchor.kind === "sleeve"
      ? (sizeAnchors.sleeve_center_x ?? midX)
      : anchor.kind === "panel"
        ? // Аксессуар без горловины меряется от реальной оси; этикетка — от центра зоны.
          (sizeAnchors.center_axis_x ?? zone.zx + zone.zw / 2)
        : (sizeAnchors.center_axis_x ?? midX);
  const anchorY =
    anchor.kind === "sleeve"
      ? (sizeAnchors.sleeve_bottom_y ?? zone.zy + zone.zh)
      : anchor.kind === "panel"
        ? zone.zy
        : (sizeAnchors.neckline_point?.y ?? zone.zy);

  return (
    <>
      {/* 4 отступа до краёв зоны */}
      {arrow(zone.zx, midY, aabb.x, midY)}
      {label(
        (zone.zx + aabb.x) / 2,
        midY,
        `${Math.round(d.left)}`,
        d.left < 0 ? "#e11d48" : color,
      )}
      {arrow(aabb.x + aabb.w, midY, zone.zx + zone.zw, midY)}
      {label(
        (aabb.x + aabb.w + zone.zx + zone.zw) / 2,
        midY,
        `${Math.round(d.right)}`,
        d.right < 0 ? "#e11d48" : color,
      )}
      {arrow(midX, zone.zy, midX, aabb.y)}
      {label(
        midX,
        (zone.zy + aabb.y) / 2,
        `${Math.round(d.top)}`,
        d.top < 0 ? "#e11d48" : color,
      )}
      {arrow(midX, aabb.y + aabb.h, midX, zone.zy + zone.zh)}
      {label(
        midX,
        (aabb.y + aabb.h + zone.zy + zone.zh) / 2,
        `${Math.round(d.bottom)}`,
        d.bottom < 0 ? "#e11d48" : color,
      )}

      {/* Вертикаль от горловины/низа рукава (отступ по вертикали) */}
      <Line
        points={[t.px(centerX), t.py(anchorY), t.px(centerX), t.py(midY)]}
        stroke="#e11d48"
        strokeWidth={1}
        dash={[5, 4]}
      />
      {label(
        centerX,
        (anchorY + midY) / 2,
        `${Math.round(Math.abs(anchor.vertical))}`,
        "#fb7185",
      )}

      {/* Ось изделия «от центра»: пунктирная вертикаль по center_axis_x
          (рукав — sleeve_center_x) на всю высоту зоны */}
      <Line
        points={[
          t.px(centerX),
          t.py(zone.zy),
          t.px(centerX),
          t.py(zone.zy + zone.zh),
        ]}
        stroke="#2563eb"
        strokeWidth={1}
        dash={[3, 5]}
        opacity={0.7}
      />
      {/* Горизонтальная стрелка от оси изделия до центра макета */}
      {arrow(centerX, midY, midX, midY)}
      {label(
        (centerX + midX) / 2,
        midY,
        `${Math.round(anchor.horizontal)}`,
        "#2563eb",
      )}

      {/* Размер печати Ш×В — с тёмной подложкой для читаемости */}
      <Rect
        x={t.px(midX) - 42}
        y={t.py(midY) - 9}
        width={84}
        height={18}
        cornerRadius={4}
        fill="#2563eb"
      />
      <Text
        x={t.px(midX) - 40}
        y={t.py(midY) - 7}
        width={80}
        align="center"
        text={`${Math.round(aabb.w)}×${Math.round(aabb.h)} мм`}
        fontSize={12}
        fontStyle="bold"
        fill="#ffffff"
      />
    </>
  );
}
