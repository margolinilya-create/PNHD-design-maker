"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import {
  Stage,
  Layer,
  Image as KImage,
  Line,
  Transformer,
} from "react-konva";
import { useProjectStore } from "@/lib/state/projectStore";
import { useImage } from "@/lib/hooks/useImage";
import { useColoredFlat } from "@/lib/hooks/useColoredFlat";
import { useAddArtwork } from "@/lib/hooks/useAddArtwork";
import {
  viewZone,
  anchorsForSize,
  printAreasForSize,
  flatForSize,
  viewHasZone,
} from "@/lib/geometry/view";
import type { Placement } from "@/types";
import type { Transform } from "./canvasTransform";
import {
  GridLines,
  ZoneShapes,
  NamedAxesGuides,
  DimensionOverlay,
} from "./canvasOverlays";
import { PlacementNode } from "./PlacementNode";

export function EditorCanvas() {
  const view = useProjectStore((s) => s.currentView());
  const placements = useProjectStore((s) => s.placements);
  const selectedId = useProjectStore((s) => s.selectedPlacementId);
  const garmentSize = useProjectStore((s) => s.size);
  const selectPlacement = useProjectStore((s) => s.selectPlacement);
  const updatePlacement = useProjectStore((s) => s.updatePlacement);

  const removePlacement = useProjectStore((s) => s.removePlacement);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 640 });
  // Экранный zoom/pan держим ОТДЕЛЬНО от pxPerMM (метрика мм неизменна).
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // Live-гайды выравнивания при перетаскивании (мм-координаты линий).
  const [guides, setGuides] = useState<{ x?: number; y?: number } | null>(null);
  // Drag-n-drop загрузки макета на холст.
  const addArtwork = useAddArtwork();
  const [dropActive, setDropActive] = useState(false);

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

  const garmentColor = useProjectStore((s) => s.garmentColor);
  const baseFlat = view ? flatForSize(view, garmentSize ?? undefined) : null;
  const coloredFlat = useColoredFlat(baseFlat, garmentColor);
  const flat = useImage(coloredFlat);

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

  // Нанесения текущего вида (id зоны может быть per-size — viewHasZone).
  const viewPlacements = useMemo(() => {
    if (!view) return [];
    return placements.filter((p) => viewHasZone(view, p.print_area_id));
  }, [placements, view]);

  const nodeRefs = useRef<Map<string, Konva.Image>>(new Map());
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const sel = selectedId
      ? viewPlacements.find((x) => x.id === selectedId)
      : null;
    const node =
      sel && !sel.locked && !sel.hidden
        ? nodeRefs.current.get(selectedId!)
        : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, viewPlacements]);

  if (!view) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        Выберите вид изделия
      </div>
    );
  }

  const { zone, safeInsetMm } = viewZone(view, garmentSize ?? undefined);

  // Цели привязки для нанесения: ось изделия, именованные оси, центр зоны (мм).
  const snapTargets = (p: Placement) => {
    const { zone } = viewZone(view, garmentSize ?? undefined, p.print_area_id);
    const a = garmentSize ? anchorsForSize(view, garmentSize) : view.anchors;
    const axis =
      view.kind === "sleeve_left" || view.kind === "sleeve_right"
        ? (a.sleeve_center_x ?? zone.zx + zone.zw / 2)
        : (a.center_axis_x ?? zone.zx + zone.zw / 2);
    return {
      axis,
      namedAxes: (a.axes ?? []).map((ax) => ax.x),
      zoneCx: zone.zx + zone.zw / 2,
      zoneCy: zone.zy + zone.zh / 2,
    };
  };

  /** Магнит X к оси изделия / именованным осям / центру зоны (порог SNAP мм). */
  const snapX = (
    cxmm: number,
    tg: { axis: number; namedAxes: number[]; zoneCx: number },
  ): number | null => {
    const SNAP = 5;
    for (const x of [tg.axis, ...tg.namedAxes, tg.zoneCx]) {
      if (Math.abs(cxmm - x) < SNAP) return x;
    }
    return null;
  };

  // Live-привязка при перетаскивании: магнитим узел и показываем гайды.
  const onDragMove = (p: Placement, node: Konva.Image) => {
    const SNAP = 5;
    const tg = snapTargets(p);
    let cxmm = (node.x() - t.px(0)) / t.pxPerMM;
    let cymm = (node.y() - t.py(0)) / t.pxPerMM;
    let gy: number | undefined;
    const sx = snapX(cxmm, tg);
    if (sx !== null) cxmm = sx;
    if (Math.abs(cymm - tg.zoneCy) < SNAP) {
      cymm = tg.zoneCy;
      gy = tg.zoneCy;
    }
    node.x(t.px(cxmm));
    node.y(t.py(cymm));
    setGuides(sx === null && gy === undefined ? null : { x: sx ?? undefined, y: gy });
  };

  // Узлы рендерятся с центр-ориджином → node.x()/y() = центр (мм).
  const onDragEnd = (p: Placement, node: Konva.Image) => {
    setGuides(null);
    let cxmm = (node.x() - t.px(0)) / t.pxPerMM;
    let cymm = (node.y() - t.py(0)) / t.pxPerMM;
    const SNAP = 5;
    const tg = snapTargets(p);
    const sx = snapX(cxmm, tg);
    if (sx !== null) cxmm = sx;
    if (Math.abs(cymm - tg.zoneCy) < SNAP) cymm = tg.zoneCy;
    updatePlacement(p.id, {
      x_mm: cxmm - p.width_mm / 2,
      y_mm: cymm - p.height_mm / 2,
    });
  };

  const onTransformEnd = (p: Placement, node: Konva.Image) => {
    const sx = node.scaleX();
    const sy = node.scaleY();
    const wpx = Math.max(4, node.width() * Math.abs(sx));
    const hpx = Math.max(4, node.height() * Math.abs(sy));
    const flip_h = sx < 0;
    const flip_v = sy < 0;
    node.scaleX(flip_h ? -1 : 1);
    node.scaleY(flip_v ? -1 : 1);
    const w_mm = wpx / t.pxPerMM;
    const h_mm = hpx / t.pxPerMM;
    const cxmm = (node.x() - t.px(0)) / t.pxPerMM;
    const cymm = (node.y() - t.py(0)) / t.pxPerMM;
    updatePlacement(p.id, {
      x_mm: cxmm - w_mm / 2,
      y_mm: cymm - h_mm / 2,
      width_mm: w_mm,
      height_mm: h_mm,
      rotation_deg: node.rotation(),
      flip_h,
      flip_v,
    });
  };

  // Drop файла на холст: позиция курсора → мм, целевая зона по попаданию.
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropActive(false);
    const el = containerRef.current;
    const files = Array.from(e.dataTransfer.files).filter(
      (f) =>
        /image\/(png|svg\+xml|jpeg)/.test(f.type) ||
        f.type === "application/pdf" ||
        /\.(png|svg|jpe?g|pdf|ai)$/i.test(f.name),
    );
    if (!el || !files.length) return;
    const rect = el.getBoundingClientRect();
    const lx = (e.clientX - rect.left - stagePos.x) / stageScale;
    const ly = (e.clientY - rect.top - stagePos.y) / stageScale;
    const xMm = (lx - t.px(0)) / t.pxPerMM;
    const yMm = (ly - t.py(0)) / t.pxPerMM;
    const areas = printAreasForSize(view, garmentSize ?? undefined);
    const hit = areas.find((a) => {
      const xs = a.polygon_mm.map((p) => p[0]);
      const ys = a.polygon_mm.map((p) => p[1]);
      return (
        xMm >= Math.min(...xs) && xMm <= Math.max(...xs) &&
        yMm >= Math.min(...ys) && yMm <= Math.max(...ys)
      );
    });
    for (const f of files) {
      await addArtwork(f, { at: { xMm, yMm }, areaId: hit?.id });
    }
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

  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Снятие выбора по клику на пустой фон (на onClick, не на mousedown —
    // чтобы не конфликтовать с панорамой draggable-стейджа).
    if (e.target === e.target.getStage()) selectPlacement(null);
  };

  // Клавиатура: Delete/Backspace — удалить, Esc — снять выбор,
  // стрелки — сдвиг выбранного на 1 мм (Shift — 10 мм).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Undo / redo (Ctrl/Cmd+Z, Shift для redo; Ctrl/Cmd+Y).
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      redo();
      return;
    }
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
      onDragOver={(e) => {
        e.preventDefault();
        setDropActive(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDropActive(false);
      }}
      onDrop={handleDrop}
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

        {/* Слой 2 — печатная зона + safe-zone + именованные оси */}
        <Layer listening={false}>
          <ZoneShapes view={view} t={t} size={garmentSize ?? undefined} />
          <NamedAxesGuides
            view={view}
            t={t}
            size={garmentSize ?? undefined}
            flatH={flatMm.h}
          />
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
              interactive={!p.locked && !p.hidden}
              onSelect={() => selectPlacement(p.id)}
              registerRef={(n) => {
                if (n) nodeRefs.current.set(p.id, n);
                else nodeRefs.current.delete(p.id);
              }}
              onDragMove={onDragMove}
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

        {/* Гайды выравнивания (live при перетаскивании) */}
        <Layer listening={false}>
          {guides?.x !== undefined && (
            <Line
              points={[t.px(guides.x), t.py(0), t.px(guides.x), t.py(flatMm.h)]}
              stroke="#d97706"
              strokeWidth={1}
              dash={[4, 4]}
            />
          )}
          {guides?.y !== undefined && (
            <Line
              points={[t.px(0), t.py(guides.y), t.px(flatMm.w), t.py(guides.y)]}
              stroke="#d97706"
              strokeWidth={1}
              dash={[4, 4]}
            />
          )}
        </Layer>

      </Stage>

      {/* Подсветка зоны сброса файла */}
      {dropActive && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-500 bg-blue-500/10">
          <span className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
            Отпустите, чтобы добавить макет
          </span>
        </div>
      )}

      {/* Пустое состояние — мягкая подсказка поверх холста */}
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-dashed border-line bg-white/70 px-5 py-4 text-center text-sm text-gray-500 shadow-sm backdrop-blur-sm">
            <div className="mb-0.5 font-medium text-gray-700">
              Загрузите макет
            </div>
            <div className="text-xs text-gray-500">панель справа</div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-white/85 px-2 py-1 text-xs text-gray-600">
        зона {Math.round(zone.zw)}×{Math.round(zone.zh)} мм · safe{" "}
        {safeInsetMm} мм · {t.pxPerMM.toFixed(2)} px/мм · zoom{" "}
        {Math.round(stageScale * 100)}%
      </div>
    </div>
  );
}
