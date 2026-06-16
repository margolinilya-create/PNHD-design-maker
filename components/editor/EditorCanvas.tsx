"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import {
  Stage,
  Layer,
  Group,
  Image as KImage,
  Line,
  Rect,
  Transformer,
  Arrow,
  Text,
} from "react-konva";
import { useProjectStore } from "@/lib/state/projectStore";
import { useImage } from "@/lib/hooks/useImage";
import { placementInfo, viewZone } from "@/lib/geometry/view";
import type { Placement, View } from "@/types";

/** Линейная развёртка мм → px стейджа. */
interface Transform {
  px: (xMm: number) => number;
  py: (yMm: number) => number;
  s: (mm: number) => number;
  pxPerMM: number;
}

export function EditorCanvas() {
  const view = useProjectStore((s) => s.currentView());
  const placements = useProjectStore((s) => s.placements);
  const selectedId = useProjectStore((s) => s.selectedPlacementId);
  const selectPlacement = useProjectStore((s) => s.selectPlacement);
  const updatePlacement = useProjectStore((s) => s.updatePlacement);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 640 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const flat = useImage(view?.flat_svg ?? null);

  const flatMm = useMemo(() => {
    const scale = view?.scale_mm_per_unit ?? 1;
    if (flat) {
      return {
        w: flat.naturalWidth * scale,
        h: flat.naturalHeight * scale,
      };
    }
    return { w: 600, h: 760 };
  }, [flat, view?.scale_mm_per_unit]);

  const t: Transform = useMemo(() => {
    const pad = 48;
    const pxPerMM = Math.max(
      0.05,
      Math.min(
        (size.width - 2 * pad) / flatMm.w,
        (size.height - 2 * pad) / flatMm.h,
      ),
    );
    const offsetX = (size.width - flatMm.w * pxPerMM) / 2;
    const offsetY = (size.height - flatMm.h * pxPerMM) / 2;
    return {
      pxPerMM,
      px: (xMm) => offsetX + xMm * pxPerMM,
      py: (yMm) => offsetY + yMm * pxPerMM,
      s: (mm) => mm * pxPerMM,
    };
  }, [size, flatMm]);

  // Нанесения текущего вида.
  const viewPlacements = useMemo(() => {
    if (!view) return [];
    const areaIds = new Set(view.print_areas.map((a) => a.id));
    return placements.filter((p) => areaIds.has(p.print_area_id));
  }, [placements, view]);

  const nodeRefs = useRef<Map<string, Konva.Image>>(new Map());
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current.get(selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, viewPlacements]);

  if (!view) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Выберите вид изделия
      </div>
    );
  }

  const { zone, safeInsetMm } = viewZone(view);

  const onDragEnd = (p: Placement, node: Konva.Image) => {
    updatePlacement(p.id, {
      x_mm: (node.x() - t.px(0)) / t.pxPerMM,
      y_mm: (node.y() - t.py(0)) / t.pxPerMM,
    });
  };

  const onTransformEnd = (p: Placement, node: Konva.Image) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const newWpx = Math.max(4, node.width() * scaleX);
    const newHpx = Math.max(4, node.height() * scaleY);
    node.scaleX(1);
    node.scaleY(1);
    updatePlacement(p.id, {
      x_mm: (node.x() - t.px(0)) / t.pxPerMM,
      y_mm: (node.y() - t.py(0)) / t.pxPerMM,
      width_mm: newWpx / t.pxPerMM,
      height_mm: newHpx / t.pxPerMM,
      rotation_deg: node.rotation(),
    });
  };

  return (
    <div ref={containerRef} className="h-full w-full">
      <Stage
        width={size.width}
        height={size.height}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) selectPlacement(null);
        }}
      >
        {/* Слой 1 — флэт изделия */}
        <Layer listening={false}>
          {flat && (
            <KImage
              image={flat}
              x={t.px(0)}
              y={t.py(0)}
              width={t.s(flatMm.w)}
              height={t.s(flatMm.h)}
            />
          )}
        </Layer>

        {/* Слой 2 — печатная зона + safe-zone */}
        <Layer listening={false}>
          <ZoneShapes view={view} t={t} />
        </Layer>

        {/* Слой 3 — нанесения */}
        <Layer>
          {viewPlacements.map((p) => (
            <PlacementNode
              key={p.id}
              placement={p}
              view={view}
              t={t}
              selected={p.id === selectedId}
              onSelect={() => selectPlacement(p.id)}
              registerRef={(n) => {
                if (n) nodeRefs.current.set(p.id, n);
                else nodeRefs.current.delete(p.id);
              }}
              onDragEnd={onDragEnd}
              onTransformEnd={onTransformEnd}
            />
          ))}
          <Transformer
            ref={trRef}
            keepRatio
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            enabledAnchors={[
              "top-left",
              "top-right",
              "bottom-left",
              "bottom-right",
            ]}
            boundBoxFunc={(oldB, newB) =>
              newB.width < 8 || newB.height < 8 ? oldB : newB
            }
          />
        </Layer>

        {/* Слой 4 — обвязка/оверлеи выбранного нанесения */}
        <Layer listening={false}>
          {selectedId &&
            (() => {
              const p = viewPlacements.find((x) => x.id === selectedId);
              if (!p) return null;
              return <DimensionOverlay placement={p} view={view} t={t} />;
            })()}
        </Layer>
      </Stage>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/50 px-2 py-1 text-xs text-neutral-300">
        зона {Math.round(zone.zw)}×{Math.round(zone.zh)} мм · safe{" "}
        {safeInsetMm} мм · {t.pxPerMM.toFixed(2)} px/мм
      </div>
    </div>
  );
}

function ZoneShapes({ view, t }: { view: View; t: Transform }) {
  return (
    <>
      {view.print_areas.map((area) => {
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
              stroke="#4f8cff"
              strokeWidth={1.5}
              dash={[8, 6]}
              fill="rgba(79,140,255,0.06)"
            />
            <Rect
              x={t.px(minX + inset)}
              y={t.py(minY + inset)}
              width={t.s(maxX - minX - 2 * inset)}
              height={t.s(maxY - minY - 2 * inset)}
              stroke="#39d98a"
              strokeWidth={1}
              dash={[4, 4]}
            />
          </Group>
        );
      })}
    </>
  );
}

function PlacementNode({
  placement: p,
  view,
  t,
  selected,
  onSelect,
  registerRef,
  onDragEnd,
  onTransformEnd,
}: {
  placement: Placement;
  view: View;
  t: Transform;
  selected: boolean;
  onSelect: () => void;
  registerRef: (n: Konva.Image | null) => void;
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
      ),
    [view, p.x_mm, p.y_mm, p.width_mm, p.height_mm, p.rotation_deg],
  );
  const out = info.check.out_of_zone;

  return (
    <KImage
      ref={registerRef}
      image={img ?? undefined}
      x={t.px(p.x_mm)}
      y={t.py(p.y_mm)}
      width={t.s(p.width_mm)}
      height={t.s(p.height_mm)}
      rotation={p.rotation_deg}
      draggable
      stroke={out ? "#ff5a5f" : selected ? "#4f8cff" : undefined}
      strokeWidth={out || selected ? 1.5 : 0}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onDragEnd(p, e.target as Konva.Image)}
      onTransformEnd={(e) => onTransformEnd(p, e.target as Konva.Image)}
    />
  );
}

function DimensionOverlay({
  placement: p,
  view,
  t,
}: {
  placement: Placement;
  view: View;
  t: Transform;
}) {
  const info = placementInfo(
    view,
    { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
    p.rotation_deg,
  );
  const { aabb, zone, dimensions: d, anchor } = info;
  const midX = aabb.x + aabb.w / 2;
  const midY = aabb.y + aabb.h / 2;
  const color = "#cbd2da";

  const label = (
    x: number,
    y: number,
    text: string,
    fill = color,
  ) => (
    <Text
      x={t.px(x) - 24}
      y={t.py(y) - 7}
      width={48}
      align="center"
      text={text}
      fontSize={11}
      fill={fill}
    />
  );

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

  // Якорь центра/горловины.
  const centerX =
    anchor.kind === "neckline"
      ? (view.anchors.center_axis_x ?? midX)
      : (view.anchors.sleeve_center_x ?? midX);
  const anchorY =
    anchor.kind === "neckline"
      ? (view.anchors.neckline_point?.y ?? zone.zy)
      : (view.anchors.sleeve_bottom_y ?? zone.zy + zone.zh);

  return (
    <>
      {/* 4 отступа до краёв зоны */}
      {arrow(zone.zx, midY, aabb.x, midY)}
      {label(
        (zone.zx + aabb.x) / 2,
        midY,
        `${Math.round(d.left)}`,
        d.left < 0 ? "#ff5a5f" : color,
      )}
      {arrow(aabb.x + aabb.w, midY, zone.zx + zone.zw, midY)}
      {label(
        (aabb.x + aabb.w + zone.zx + zone.zw) / 2,
        midY,
        `${Math.round(d.right)}`,
        d.right < 0 ? "#ff5a5f" : color,
      )}
      {arrow(midX, zone.zy, midX, aabb.y)}
      {label(
        midX,
        (zone.zy + aabb.y) / 2,
        `${Math.round(d.top)}`,
        d.top < 0 ? "#ff5a5f" : color,
      )}
      {arrow(midX, aabb.y + aabb.h, midX, zone.zy + zone.zh)}
      {label(
        midX,
        (aabb.y + aabb.h + zone.zy + zone.zh) / 2,
        `${Math.round(d.bottom)}`,
        d.bottom < 0 ? "#ff5a5f" : color,
      )}

      {/* Вертикаль от горловины/низа рукава */}
      <Line
        points={[t.px(centerX), t.py(anchorY), t.px(centerX), t.py(midY)]}
        stroke="#ff5a5f"
        strokeWidth={1}
        dash={[5, 4]}
      />
      {label(
        centerX,
        (anchorY + midY) / 2,
        `${Math.round(Math.abs(anchor.vertical))}`,
        "#ff8a8d",
      )}

      {/* Размер печати */}
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
