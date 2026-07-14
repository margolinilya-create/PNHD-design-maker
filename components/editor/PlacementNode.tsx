"use client";

import { useMemo } from "react";
import type Konva from "konva";
import { Group, Image as KImage, Rect } from "react-konva";
import { useProjectStore } from "@/lib/state/projectStore";
import { useImage } from "@/lib/hooks/useImage";
import { placementInfo } from "@/lib/geometry/view";
import type { Placement, View } from "@/types";
import type { Transform } from "./canvasTransform";

export function PlacementNode({
  placement: p,
  view,
  t,
  garmentSize,
  selected,
  interactive,
  onSelect,
  registerRef,
  onDragMove,
  onDragEnd,
  onTransformEnd,
}: {
  placement: Placement;
  view: View;
  t: Transform;
  garmentSize: string | null;
  selected: boolean;
  interactive: boolean;
  onSelect: () => void;
  registerRef: (n: Konva.Image | null) => void;
  onDragMove: (p: Placement, n: Konva.Image) => void;
  onDragEnd: (p: Placement, n: Konva.Image) => void;
  onTransformEnd: (p: Placement, n: Konva.Image) => void;
}) {
  const asset = useProjectStore((s) => s.assets[p.asset_id]);
  const img = useImage(asset?.data_url ?? null);
  const info = useMemo(
    () =>
      placementInfo(
        view,
        { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
        p.rotation_deg,
        garmentSize ?? undefined,
        p.print_area_id,
      ),
    [
      view,
      p.x_mm,
      p.y_mm,
      p.width_mm,
      p.height_mm,
      p.rotation_deg,
      p.print_area_id,
      garmentSize,
    ],
  );
  const out = info.check.out_of_zone;
  const zone = info.zone;

  if (p.hidden) return null;

  const wpx = t.s(p.width_mm);
  const hpx = t.s(p.height_mm);

  return (
    <>
      {/* Маскирование по печатной зоне: всё вне зоны визуально обрезается. */}
      <Group
        clipX={t.px(zone.zx)}
        clipY={t.py(zone.zy)}
        clipWidth={t.s(zone.zw)}
        clipHeight={t.s(zone.zh)}
      >
        {/* Центр-ориджин: поворот и флип — вокруг центра нанесения. */}
        <KImage
          ref={registerRef}
          image={img ?? undefined}
          x={t.px(p.x_mm) + wpx / 2}
          y={t.py(p.y_mm) + hpx / 2}
          width={wpx}
          height={hpx}
          offsetX={wpx / 2}
          offsetY={hpx / 2}
          rotation={p.rotation_deg}
          scaleX={p.flip_h ? -1 : 1}
          scaleY={p.flip_v ? -1 : 1}
          draggable={interactive}
          stroke={selected ? "#2563eb" : undefined}
          strokeWidth={selected ? 1.5 : 0}
          onMouseDown={interactive ? onSelect : undefined}
          onTap={interactive ? onSelect : undefined}
          onDragMove={(e) => onDragMove(p, e.target as Konva.Image)}
          onDragEnd={(e) => onDragEnd(p, e.target as Konva.Image)}
          onTransformEnd={(e) => onTransformEnd(p, e.target as Konva.Image)}
        />
      </Group>
      {/* Предупреждение: при выходе за зону подсвечиваем её красным. */}
      {out && (
        <Rect
          x={t.px(zone.zx)}
          y={t.py(zone.zy)}
          width={t.s(zone.zw)}
          height={t.s(zone.zh)}
          stroke="#e11d48"
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
      )}
    </>
  );
}
