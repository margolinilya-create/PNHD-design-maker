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
  Circle,
  Transformer,
  Arrow,
  Text,
} from "react-konva";
import { useProjectStore } from "@/lib/state/projectStore";
import { useImage } from "@/lib/hooks/useImage";
import { useColoredFlat } from "@/lib/hooks/useColoredFlat";
import { useAddArtwork } from "@/lib/hooks/useAddArtwork";
import {
  placementInfo,
  viewZone,
  anchorsForSize,
  printAreasForSize,
  flatForSize,
} from "@/lib/geometry/view";
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
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 640 });
  // Экранный zoom/pan держим ОТДЕЛЬНО от pxPerMM (метрика мм неизменна).
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // Проверка точности лекала: режим линейки и оверлей якорей/линеек.
  const [mode, setMode] = useState<"select" | "measure">("select");
  const [measurePts, setMeasurePts] = useState<{ x: number; y: number }[]>([]);
  const [showCheck, setShowCheck] = useState(false);
  // Калибровка: реальная длина измеренного отрезка (мм).
  const [realLen, setRealLen] = useState("");
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
    const sel = selectedId
      ? viewPlacements.find((x) => x.id === selectedId)
      : null;
    const node =
      sel && mode === "select" && !sel.locked && !sel.hidden
        ? nodeRefs.current.get(selectedId!)
        : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, viewPlacements, mode]);

  // Сброс линейки при смене вида.
  const viewId = view?.id;
  useEffect(() => {
    setMeasurePts([]);
  }, [viewId]);

  if (!view) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Выберите вид изделия
      </div>
    );
  }

  const { zone, safeInsetMm } = viewZone(view, garmentSize ?? undefined);

  // Цель привязки для нанесения: ось изделия, центр зоны (мм).
  const snapTargets = (p: Placement) => {
    const { zone } = viewZone(view, garmentSize ?? undefined, p.print_area_id);
    const a = garmentSize ? anchorsForSize(view, garmentSize) : view.anchors;
    const axis =
      view.kind === "sleeve_left" || view.kind === "sleeve_right"
        ? (a.sleeve_center_x ?? zone.zx + zone.zw / 2)
        : (a.center_axis_x ?? zone.zx + zone.zw / 2);
    return { axis, zoneCx: zone.zx + zone.zw / 2, zoneCy: zone.zy + zone.zh / 2 };
  };

  // Live-привязка при перетаскивании: магнитим узел и показываем гайды.
  const onDragMove = (p: Placement, node: Konva.Image) => {
    const SNAP = 5;
    const { axis, zoneCx, zoneCy } = snapTargets(p);
    let cxmm = (node.x() - t.px(0)) / t.pxPerMM;
    let cymm = (node.y() - t.py(0)) / t.pxPerMM;
    let gx: number | undefined;
    let gy: number | undefined;
    if (Math.abs(cxmm - axis) < SNAP) {
      cxmm = axis;
      gx = axis;
    } else if (Math.abs(cxmm - zoneCx) < SNAP) {
      cxmm = zoneCx;
      gx = zoneCx;
    }
    if (Math.abs(cymm - zoneCy) < SNAP) {
      cymm = zoneCy;
      gy = zoneCy;
    }
    node.x(t.px(cxmm));
    node.y(t.py(cymm));
    setGuides(gx === undefined && gy === undefined ? null : { x: gx, y: gy });
  };

  // Узлы рендерятся с центр-ориджином → node.x()/y() = центр (мм).
  const onDragEnd = (p: Placement, node: Konva.Image) => {
    setGuides(null);
    let cxmm = (node.x() - t.px(0)) / t.pxPerMM;
    let cymm = (node.y() - t.py(0)) / t.pxPerMM;
    // Привязка: магнит к оси изделия и центру зоны (порог 5 мм).
    const { zone } = viewZone(view, garmentSize ?? undefined, p.print_area_id);
    const a = garmentSize ? anchorsForSize(view, garmentSize) : view.anchors;
    const axis =
      view.kind === "sleeve_left" || view.kind === "sleeve_right"
        ? (a.sleeve_center_x ?? zone.zx + zone.zw / 2)
        : (a.center_axis_x ?? zone.zx + zone.zw / 2);
    const SNAP = 5;
    const zoneCx = zone.zx + zone.zw / 2;
    const zoneCy = zone.zy + zone.zh / 2;
    if (Math.abs(cxmm - axis) < SNAP) cxmm = axis;
    else if (Math.abs(cxmm - zoneCx) < SNAP) cxmm = zoneCx;
    if (Math.abs(cymm - zoneCy) < SNAP) cymm = zoneCy;
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
      (f) => /image\/(png|svg\+xml)/.test(f.type) || /\.(png|svg)$/i.test(f.name),
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

  // Курсор экрана → мм (учитываем zoom/pan стейджа и метрику pxPerMM).
  const pointerToMm = (): { x: number; y: number } | null => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return null;
    const lx = (pointer.x - stagePos.x) / stageScale;
    const ly = (pointer.y - stagePos.y) / stageScale;
    return {
      x: (lx - t.px(0)) / t.pxPerMM,
      y: (ly - t.py(0)) / t.pxPerMM,
    };
  };

  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (mode === "measure") {
      const pt = pointerToMm();
      if (!pt) return;
      // 1-я точка ставит A, 2-я — B, 3-й клик начинает заново.
      setMeasurePts((prev) => (prev.length >= 2 ? [pt] : [...prev, pt]));
      return;
    }
    // Снятие выбора по клику на пустой фон (на onClick, не на mousedown —
    // чтобы не конфликтовать с панорамой draggable-стейджа).
    if (e.target === e.target.getStage()) selectPlacement(null);
  };

  // Дистанция линейки в мм (между двумя точками).
  const measureDistMm =
    measurePts.length === 2
      ? Math.hypot(
          measurePts[1].x - measurePts[0].x,
          measurePts[1].y - measurePts[0].y,
        )
      : null;

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
      setMeasurePts([]);
      setRealLen("");
      if (mode === "measure") setMode("select");
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
        draggable={mode === "select"}
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
          <ZoneShapes view={view} t={t} size={garmentSize ?? undefined} />
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
              interactive={mode === "select" && !p.locked && !p.hidden}
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
              stroke="#f59e0b"
              strokeWidth={1}
              dash={[4, 4]}
            />
          )}
          {guides?.y !== undefined && (
            <Line
              points={[t.px(0), t.py(guides.y), t.px(flatMm.w), t.py(guides.y)]}
              stroke="#f59e0b"
              strokeWidth={1}
              dash={[4, 4]}
            />
          )}
        </Layer>

        {/* Слой 5 — проверка точности лекала: якоря/оси/линейки + линейка-измеритель */}
        <Layer listening={false}>
          {showCheck && (
            <VerificationOverlay
              view={view}
              flatMm={flatMm}
              t={t}
              garmentSize={garmentSize}
            />
          )}
          {measurePts.length > 0 && (
            <MeasureOverlay
              points={measurePts}
              distMm={measureDistMm}
              t={t}
            />
          )}
        </Layer>
      </Stage>

      {/* Тулбар проверки точности (поверх холста) */}
      <div className="absolute left-3 top-3 flex gap-1.5">
        <button
          onClick={() => {
            setShowCheck((v) => !v);
          }}
          className={`rounded-md px-2.5 py-1 text-xs font-medium shadow ${
            showCheck
              ? "bg-blue-600 text-white"
              : "bg-neutral-800/90 text-neutral-300 hover:bg-neutral-700"
          }`}
          title="Показать якоря, оси и краевые линейки лекала"
        >
          Проверка лекала
        </button>
        <button
          onClick={() => {
            setMode((m) => (m === "measure" ? "select" : "measure"));
            setMeasurePts([]);
            setRealLen("");
          }}
          className={`rounded-md px-2.5 py-1 text-xs font-medium shadow ${
            mode === "measure"
              ? "bg-amber-500 text-black"
              : "bg-neutral-800/90 text-neutral-300 hover:bg-neutral-700"
          }`}
          title="Линейка: кликните две точки на лекале, чтобы измерить в мм"
        >
          Линейка{measureDistMm != null ? ` · ${measureDistMm.toFixed(1)} мм` : ""}
        </button>
      </div>

      {/* Калибровка масштаба: измеренный отрезок → реальная длина → scale_mm_per_unit */}
      {mode === "measure" && measureDistMm != null && (
        <div className="absolute left-3 top-12 w-56 rounded-md border border-neutral-700 bg-neutral-900/95 p-2.5 text-xs shadow-lg">
          <div className="mb-1 text-neutral-400">
            Измерено:{" "}
            <span className="font-medium text-neutral-200">
              {measureDistMm.toFixed(1)} мм
            </span>{" "}
            (при текущем масштабе)
          </div>
          <label className="mb-1 block text-neutral-400">
            Реальная длина, мм
          </label>
          <input
            type="number"
            value={realLen}
            onChange={(e) => setRealLen(e.target.value)}
            placeholder="напр. 100"
            className="mb-2 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 tabular-nums"
          />
          {(() => {
            const real = parseFloat(realLen.replace(",", "."));
            if (!Number.isFinite(real) || real <= 0 || measureDistMm <= 0) {
              return (
                <p className="text-neutral-500">
                  Введите реальный размер этого отрезка по лекалу.
                </p>
              );
            }
            const cur = view.scale_mm_per_unit ?? 1;
            const suggested = cur * (real / measureDistMm);
            const off = Math.abs(real - measureDistMm);
            return (
              <div>
                <div className="text-neutral-300">
                  scale_mm_per_unit ≈{" "}
                  <span className="font-semibold text-emerald-400 tabular-nums">
                    {suggested.toFixed(4)}
                  </span>
                </div>
                <div className="mt-0.5 text-neutral-500">
                  {off < 0.5
                    ? "масштаб совпадает (1:1)"
                    : `расхождение ${off.toFixed(1)} мм — впишите значение в skus.json для этого вида`}
                </div>
              </div>
            );
          })()}
        </div>
      )}

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

function ZoneShapes({
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
          stroke={selected ? "#4f8cff" : undefined}
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
          stroke="#ff5a5f"
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
      )}
    </>
  );
}

/** Линейка-измеритель: две точки в мм + подпись дистанции. */
function MeasureOverlay({
  points,
  distMm,
  t,
}: {
  points: { x: number; y: number }[];
  distMm: number | null;
  t: Transform;
}) {
  const a = points[0];
  const b = points[1];
  const color = "#f59e0b";
  return (
    <>
      {a && (
        <Circle x={t.px(a.x)} y={t.py(a.y)} radius={3} fill={color} />
      )}
      {b && (
        <Circle x={t.px(b.x)} y={t.py(b.y)} radius={3} fill={color} />
      )}
      {a && b && (
        <>
          <Line
            points={[t.px(a.x), t.py(a.y), t.px(b.x), t.py(b.y)]}
            stroke={color}
            strokeWidth={1}
            dash={[4, 3]}
          />
          {distMm != null &&
            (() => {
              const mx = t.px((a.x + b.x) / 2);
              const my = t.py((a.y + b.y) / 2);
              const text = `${distMm.toFixed(1)} мм`;
              const w = text.length * 7 + 8;
              return (
                <Group>
                  <Rect
                    x={mx - w / 2}
                    y={my - 18}
                    width={w}
                    height={15}
                    cornerRadius={3}
                    fill="rgba(15,18,24,0.8)"
                  />
                  <Text
                    x={mx - w / 2}
                    y={my - 15}
                    width={w}
                    align="center"
                    text={text}
                    fontSize={11}
                    fontStyle="bold"
                    fill={color}
                  />
                </Group>
              );
            })()}
        </>
      )}
    </>
  );
}

/**
 * Оверлей проверки лекала: якоря (горловина/центр/низ рукава), ось изделия
 * и краевые линейки с тиками каждые 50 мм — для глаз-сверки импортированного лекала.
 */
function VerificationOverlay({
  view,
  flatMm,
  t,
  garmentSize,
}: {
  view: View;
  flatMm: { w: number; h: number };
  t: Transform;
  garmentSize: string | null;
}) {
  const a = garmentSize ? anchorsForSize(view, garmentSize) : view.anchors;
  const isSleeve = view.kind === "sleeve_left" || view.kind === "sleeve_right";
  const tickColor = "rgba(148,163,184,0.55)";
  const step = 50;

  // Краевые линейки: тики сверху (по X) и слева (по Y) с подписями.
  const ticks: React.ReactNode[] = [];
  for (let x = 0; x <= flatMm.w + 0.01; x += step) {
    ticks.push(
      <Line
        key={`tx${x}`}
        points={[t.px(x), t.py(0), t.px(x), t.py(0) - 6]}
        stroke={tickColor}
        strokeWidth={1}
      />,
    );
    ticks.push(
      <Text
        key={`txl${x}`}
        x={t.px(x) - 12}
        y={t.py(0) - 18}
        width={24}
        align="center"
        text={`${x}`}
        fontSize={8}
        fill="#94a3b8"
      />,
    );
  }
  for (let y = 0; y <= flatMm.h + 0.01; y += step) {
    ticks.push(
      <Line
        key={`ty${y}`}
        points={[t.px(0), t.py(y), t.px(0) - 6, t.py(y)]}
        stroke={tickColor}
        strokeWidth={1}
      />,
    );
    ticks.push(
      <Text
        key={`tyl${y}`}
        x={t.px(0) - 30}
        y={t.py(y) - 4}
        width={22}
        align="right"
        text={`${y}`}
        fontSize={8}
        fill="#94a3b8"
      />,
    );
  }

  return (
    <>
      {ticks}
      {!isSleeve && a.center_axis_x != null && (
        <Line
          points={[t.px(a.center_axis_x), t.py(0), t.px(a.center_axis_x), t.py(flatMm.h)]}
          stroke="#4f8cff"
          strokeWidth={1}
          dash={[4, 5]}
          opacity={0.8}
        />
      )}
      {!isSleeve && a.neckline_point && (
        <>
          <Circle
            x={t.px(a.neckline_point.x)}
            y={t.py(a.neckline_point.y)}
            radius={4}
            fill="#ff5a5f"
          />
          <Text
            x={t.px(a.neckline_point.x) + 6}
            y={t.py(a.neckline_point.y) - 5}
            text="горловина"
            fontSize={9}
            fill="#ff8a8d"
          />
        </>
      )}
      {isSleeve && a.sleeve_bottom_y != null && (
        <>
          <Line
            points={[t.px(0), t.py(a.sleeve_bottom_y), t.px(flatMm.w), t.py(a.sleeve_bottom_y)]}
            stroke="#ff5a5f"
            strokeWidth={1}
            dash={[4, 4]}
          />
          <Text
            x={t.px(4)}
            y={t.py(a.sleeve_bottom_y) + 2}
            text="низ рукава"
            fontSize={9}
            fill="#ff8a8d"
          />
        </>
      )}
      {isSleeve && a.sleeve_center_x != null && (
        <Line
          points={[t.px(a.sleeve_center_x), t.py(0), t.px(a.sleeve_center_x), t.py(flatMm.h)]}
          stroke="#4f8cff"
          strokeWidth={1}
          dash={[4, 5]}
          opacity={0.8}
        />
      )}
    </>
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
    p.print_area_id,
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
    anchor.kind === "sleeve"
      ? (sizeAnchors.sleeve_center_x ?? midX)
      : anchor.kind === "panel"
        ? zone.zx + zone.zw / 2
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
