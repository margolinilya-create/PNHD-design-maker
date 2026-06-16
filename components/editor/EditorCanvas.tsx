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
import { placementInfo, viewZone, anchorsForSize } from "@/lib/geometry/view";
import type { Zone } from "@/lib/geometry/coords";
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
  const garmentSize = useProjectStore((s) => s.size);
  const selectPlacement = useProjectStore((s) => s.selectPlacement);
  const updatePlacement = useProjectStore((s) => s.updatePlacement);

  const removePlacement = useProjectStore((s) => s.removePlacement);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 640 });
  // Экранный zoom/pan держим ОТДЕЛЬНО от pxPerMM (метрика мм неизменна).
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Игнорируем нулевые размеры (скрытый/несмонтированный контейнер),
      // иначе флэт «уезжает» из-за деления на ~0.
      if (w > 0 && h > 0) setSize({ width: w, height: h });
    });
    ro.observe(el);
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    }
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

  // Зум колесом к курсору: меняем ТОЛЬКО scale/position стейджа,
  // pxPerMM остаётся метрической константой.
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = stageScale;
    const scaleBy = 1.08;
    const dir = e.evt.deltaY > 0 ? 1 / scaleBy : scaleBy;
    const newScale = Math.min(8, Math.max(0.2, oldScale * dir));
    // Точка под курсором в координатах слоя (до зума) — её удерживаем.
    const mx = (pointer.x - stagePos.x) / oldScale;
    const my = (pointer.y - stagePos.y) / oldScale;
    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mx * newScale,
      y: pointer.y - my * newScale,
    });
  };

  // Снятие выбора по клику на пустой фон (на onClick, не на mousedown —
  // чтобы не конфликтовать с панорамой draggable-стейджа).
  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) selectPlacement(null);
  };

  // Клавиатура: Delete/Backspace — удалить, Esc — снять выбор,
  // стрелки — сдвиг выбранного на 1 мм (Shift — 10 мм).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      selectPlacement(null);
      return;
    }
    if (!selectedId) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removePlacement(selectedId);
      return;
    }
    const p = viewPlacements.find((x) => x.id === selectedId);
    if (!p) return;
    const step = e.shiftKey ? 10 : 1; // мм
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    e.preventDefault();
    updatePlacement(p.id, { x_mm: p.x_mm + dx, y_mm: p.y_mm + dy });
  };

  // Пустое состояние: у текущего вида нет нанесений.
  const isEmpty = viewPlacements.length === 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="relative h-full w-full outline-none"
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        draggable
        onWheel={onWheel}
        onClick={onStageClick}
        onDragEnd={(e) => {
          // Сохраняем позицию панорамы только если двигали сам стейдж.
          if (e.target === e.target.getStage()) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
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

        {/* Сетка 50 мм под зоной — для оценки масштаба «на глаз» */}
        <Layer listening={false}>
          <GridLines zone={zone} t={t} />
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
              garmentSize={garmentSize}
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
              return (
                <DimensionOverlay
                  placement={p}
                  view={view}
                  t={t}
                  garmentSize={garmentSize}
                />
              );
            })()}
        </Layer>
      </Stage>

      {/* Пустое состояние — мягкая подсказка поверх холста */}
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/70 px-5 py-4 text-center text-sm text-neutral-400 shadow-sm backdrop-blur-sm">
            <div className="mb-0.5 font-medium text-neutral-300">
              Загрузите макет
            </div>
            <div className="text-xs text-neutral-500">панель справа</div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/50 px-2 py-1 text-xs text-neutral-300">
        зона {Math.round(zone.zw)}×{Math.round(zone.zh)} мм · safe{" "}
        {safeInsetMm} мм · {t.pxPerMM.toFixed(2)} px/мм · zoom{" "}
        {Math.round(stageScale * 100)}%
      </div>
    </div>
  );
}

/** Тонкая сетка с шагом 50 мм в пределах печатной зоны. */
function GridLines({ zone, t }: { zone: Zone; t: Transform }) {
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
  garmentSize,
  selected,
  onSelect,
  registerRef,
  onDragEnd,
  onTransformEnd,
}: {
  placement: Placement;
  view: View;
  t: Transform;
  garmentSize: string | null;
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
        garmentSize ?? undefined,
      ),
    [view, p.x_mm, p.y_mm, p.width_mm, p.height_mm, p.rotation_deg, garmentSize],
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
  );
  const { aabb, zone, dimensions: d, anchor } = info;
  const midX = aabb.x + aabb.w / 2;
  const midY = aabb.y + aabb.h / 2;
  const color = "#cbd2da";

  // Числовая подпись с тёмной полупрозрачной подложкой (halo) —
  // читаемость на светлом макете.
  const label = (
    x: number,
    y: number,
    text: string,
    fill = color,
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
          fill="rgba(15,18,24,0.6)"
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
    anchor.kind === "neckline"
      ? (sizeAnchors.center_axis_x ?? midX)
      : (sizeAnchors.sleeve_center_x ?? midX);
  const anchorY =
    anchor.kind === "neckline"
      ? (sizeAnchors.neckline_point?.y ?? zone.zy)
      : (sizeAnchors.sleeve_bottom_y ?? zone.zy + zone.zh);

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

      {/* Вертикаль от горловины/низа рукава (отступ по вертикали) */}
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

      {/* Ось изделия «от центра»: пунктирная вертикаль по center_axis_x
          (рукав — sleeve_center_x) на всю высоту зоны */}
      <Line
        points={[
          t.px(centerX),
          t.py(zone.zy),
          t.px(centerX),
          t.py(zone.zy + zone.zh),
        ]}
        stroke="#4f8cff"
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
        "#9ec1ff",
      )}

      {/* Размер печати Ш×В — с тёмной подложкой для читаемости */}
      <Rect
        x={t.px(midX) - 42}
        y={t.py(midY) - 9}
        width={84}
        height={18}
        cornerRadius={4}
        fill="rgba(15,18,24,0.65)"
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
