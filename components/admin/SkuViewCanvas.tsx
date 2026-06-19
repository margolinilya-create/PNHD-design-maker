"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import {
  Stage,
  Layer,
  Image as KImage,
  Line,
  Rect,
  Circle,
  Text,
  Group,
  Transformer,
} from "react-konva";
import { useImage } from "@/lib/hooks/useImage";
import { zoneRect, rectZone } from "@/lib/admin/skuEdit";
import type { PrintArea, View } from "@/types";

interface T {
  px: (mm: number) => number;
  py: (mm: number) => number;
  s: (mm: number) => number;
  pxPerMM: number;
  toMmX: (px: number) => number;
  toMmY: (px: number) => number;
}

const isSleeveKind = (k: string) => k === "sleeve_left" || k === "sleeve_right";

export function SkuViewCanvas({
  view,
  selectedZoneId,
  onSelectZone,
  onChange,
}: {
  view: View;
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
  onChange: (patch: Partial<View>) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [measure, setMeasure] = useState(false);
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const [realLen, setRealLen] = useState("");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0)
        setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    if (el.clientWidth > 0)
      setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const img = useImage(view.flat_svg || null);
  const sc = view.scale_mm_per_unit || 1;
  const flatMm = useMemo(() => {
    if (img) return { w: img.naturalWidth * sc, h: img.naturalHeight * sc };
    return { w: 300, h: 400 };
  }, [img, sc]);

  const t: T = useMemo(() => {
    const pad = 56;
    const pxPerMM = Math.max(
      0.02,
      Math.min(
        (size.width - 2 * pad) / flatMm.w,
        (size.height - 2 * pad) / flatMm.h,
      ),
    );
    const ox = (size.width - flatMm.w * pxPerMM) / 2;
    const oy = (size.height - flatMm.h * pxPerMM) / 2;
    return {
      pxPerMM,
      px: (mm) => ox + mm * pxPerMM,
      py: (mm) => oy + mm * pxPerMM,
      s: (mm) => mm * pxPerMM,
      toMmX: (px) => (px - ox) / pxPerMM,
      toMmY: (px) => (px - oy) / pxPerMM,
    };
  }, [size, flatMm]);

  const sleeve = isSleeveKind(view.kind);
  const label = view.kind.startsWith("label");
  const a = view.anchors;

  const measureDist =
    pts.length === 2 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : null;

  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!measure) {
      // Клик по пустому месту — снять выбор зоны не требуется.
      return;
    }
    const p = stageRef.current?.getPointerPosition();
    if (!p) return;
    const m = { x: t.toMmX(p.x), y: t.toMmY(p.y) };
    setPts((prev) => (prev.length >= 2 ? [m] : [...prev, m]));
  };

  const applyCalibration = () => {
    const real = parseFloat(realLen.replace(",", "."));
    if (!measureDist || !(real > 0)) return;
    onChange({ scale_mm_per_unit: sc * (real / measureDist) });
    setMeasure(false);
    setPts([]);
    setRealLen("");
  };

  // Зоны: обновление polygon_mm одной зоны.
  const setZoneRect = (
    area: PrintArea,
    p: Partial<{ x: number; y: number; w: number; h: number }>,
  ) => {
    const r = { ...zoneRect(area), ...p };
    const next = view.print_areas.map((z) =>
      z.id === area.id
        ? { ...z, polygon_mm: rectZone(z.id, z.name, r.x, r.y, r.w, r.h).polygon_mm }
        : z,
    );
    onChange({ print_areas: next });
  };

  // Transformer для выбранной зоны.
  const selRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (selRef.current && !measure) tr.nodes([selRef.current]);
    else tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedZoneId, measure, img, view.print_areas]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={onStageClick}
      >
        <Layer listening={false}>
          {img && (
            <KImage
              image={img}
              x={t.px(0)}
              y={t.py(0)}
              width={t.s(flatMm.w)}
              height={t.s(flatMm.h)}
            />
          )}
          {!img && (
            <Text
              x={size.width / 2 - 90}
              y={size.height / 2}
              text="Нет флэта — загрузите изображение вида"
              fontSize={13}
              fill="#666"
            />
          )}
        </Layer>

        {/* Зоны */}
        <Layer>
          {view.print_areas.map((area) => {
            const r = zoneRect(area);
            const sel = area.id === selectedZoneId;
            return (
              <Group key={area.id}>
                <Rect
                  ref={sel ? selRef : undefined}
                  x={t.px(r.x)}
                  y={t.py(r.y)}
                  width={t.s(r.w)}
                  height={t.s(r.h)}
                  stroke={sel ? "#2563eb" : "#7aa2ff99"}
                  strokeWidth={sel ? 1.8 : 1}
                  dash={[8, 6]}
                  fill={sel ? "rgba(79,140,255,0.10)" : "rgba(79,140,255,0.04)"}
                  draggable={!measure}
                  onClick={() => onSelectZone(area.id)}
                  onTap={() => onSelectZone(area.id)}
                  onDragStart={() => onSelectZone(area.id)}
                  onDragEnd={(e) => {
                    const n = e.target;
                    setZoneRect(area, { x: t.toMmX(n.x()), y: t.toMmY(n.y()) });
                  }}
                  onTransformEnd={(e) => {
                    const n = e.target as Konva.Rect;
                    const w = Math.max(5, (n.width() * n.scaleX()) / t.pxPerMM);
                    const h = Math.max(5, (n.height() * n.scaleY()) / t.pxPerMM);
                    n.scaleX(1);
                    n.scaleY(1);
                    setZoneRect(area, {
                      x: t.toMmX(n.x()),
                      y: t.toMmY(n.y()),
                      w,
                      h,
                    });
                  }}
                />
                <Text
                  x={t.px(r.x) + 3}
                  y={t.py(r.y) + 3}
                  text={area.name}
                  fontSize={11}
                  fill={sel ? "#bcd0ff" : "#7aa2ff"}
                  listening={false}
                />
              </Group>
            );
          })}
          {!measure && (
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
              boundBoxFunc={(o, nb) => (nb.width < 10 || nb.height < 10 ? o : nb)}
            />
          )}
        </Layer>

        {/* Якоря */}
        <Layer>
          {!sleeve && !label && (
            <>
              <Line
                points={[
                  t.px(a.center_axis_x ?? 0),
                  t.py(0),
                  t.px(a.center_axis_x ?? 0),
                  t.py(flatMm.h),
                ]}
                stroke="#16a34a"
                strokeWidth={1}
                dash={[5, 6]}
                listening={false}
              />
              <Handle
                x={t.px(a.center_axis_x ?? 0)}
                y={t.py(Math.max(10, (a.neckline_point?.y ?? 30) - 40))}
                color="#16a34a"
                label="ось"
                draggable={!measure}
                onMove={(px) =>
                  onChange({ anchors: { ...a, center_axis_x: t.toMmX(px.x) } })
                }
              />
              <Handle
                x={t.px(a.neckline_point?.x ?? 0)}
                y={t.py(a.neckline_point?.y ?? 0)}
                color="#e11d48"
                label="горловина"
                draggable={!measure}
                onMove={(px) =>
                  onChange({
                    anchors: {
                      ...a,
                      neckline_point: { x: t.toMmX(px.x), y: t.toMmY(px.y) },
                    },
                  })
                }
              />
            </>
          )}
          {sleeve && (
            <>
              <Line
                points={[
                  t.px(0),
                  t.py(a.sleeve_bottom_y ?? 0),
                  t.px(flatMm.w),
                  t.py(a.sleeve_bottom_y ?? 0),
                ]}
                stroke="#e11d48"
                strokeWidth={1}
                dash={[5, 6]}
                listening={false}
              />
              <Handle
                x={t.px(a.sleeve_center_x ?? 0)}
                y={t.py(a.sleeve_bottom_y ?? 0)}
                color="#e11d48"
                label="низ/центр рукава"
                draggable={!measure}
                onMove={(px) =>
                  onChange({
                    anchors: {
                      ...a,
                      sleeve_center_x: t.toMmX(px.x),
                      sleeve_bottom_y: t.toMmY(px.y),
                    },
                  })
                }
              />
            </>
          )}
        </Layer>

        {/* Калибровка */}
        <Layer listening={false}>
          {pts.map((p, i) => (
            <Circle key={i} x={t.px(p.x)} y={t.py(p.y)} radius={3} fill="#f59e0b" />
          ))}
          {pts.length === 2 && (
            <Line
              points={[
                t.px(pts[0].x),
                t.py(pts[0].y),
                t.px(pts[1].x),
                t.py(pts[1].y),
              ]}
              stroke="#f59e0b"
              strokeWidth={1}
              dash={[4, 3]}
            />
          )}
        </Layer>
      </Stage>

      <div className="absolute left-3 top-3 flex flex-col gap-2">
        <button
          onClick={() => {
            setMeasure((v) => !v);
            setPts([]);
          }}
          className={`rounded-md px-2.5 py-1 text-xs font-medium shadow ${
            measure
              ? "bg-amber-500 text-black"
              : "bg-raised text-gray-700 hover:bg-gray-200"
          }`}
        >
          Калибровка{measureDist != null ? ` · ${measureDist.toFixed(1)} мм` : ""}
        </button>
        {measure && measureDist != null && (
          <div className="w-56 rounded-md border border-line bg-white p-2.5 text-xs">
            <div className="mb-1 text-gray-500">
              Измерено {measureDist.toFixed(1)} мм (текущий масштаб)
            </div>
            <input
              type="number"
              value={realLen}
              onChange={(e) => setRealLen(e.target.value)}
              placeholder="реальная длина, мм"
              className="mb-2 w-full rounded border border-line bg-shell px-2 py-1"
            />
            <button
              onClick={applyCalibration}
              className="w-full rounded bg-emerald-600 px-2 py-1 font-medium text-white hover:bg-emerald-700"
            >
              Применить масштаб
            </button>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-[rgba(17,24,39,0.45)] px-2 py-1 text-xs text-gray-700">
        флэт {Math.round(flatMm.w)}×{Math.round(flatMm.h)} мм · scale{" "}
        {sc.toFixed(3)} мм/ед · {t.pxPerMM.toFixed(2)} px/мм
      </div>
    </div>
  );
}

function Handle({
  x,
  y,
  color,
  label,
  draggable,
  onMove,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
  draggable: boolean;
  onMove: (px: { x: number; y: number }) => void;
}) {
  return (
    <Group
      x={x}
      y={y}
      draggable={draggable}
      onDragMove={(e) => onMove({ x: e.target.x(), y: e.target.y() })}
    >
      <Circle radius={6} fill={color} stroke="#ffffff" strokeWidth={1.5} />
      <Text x={9} y={-6} text={label} fontSize={11} fill={color} />
    </Group>
  );
}
