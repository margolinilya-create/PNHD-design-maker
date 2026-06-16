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
import type { FlatDraft } from "@/lib/admin/flatDraft";

interface T {
  px: (mm: number) => number;
  py: (mm: number) => number;
  s: (mm: number) => number;
  pxPerMM: number;
  toMmX: (px: number) => number;
  toMmY: (px: number) => number;
}

const isSleeveKind = (k: string) =>
  k === "sleeve_left" || k === "sleeve_right";

export function FlatEditorCanvas({
  draft,
  onChange,
}: {
  draft: FlatDraft;
  onChange: (patch: Partial<FlatDraft>) => void;
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
    if (el.clientWidth > 0) setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const img = useImage(draft.flatDataUrl || null);
  const flatMm = useMemo(() => {
    const sc = draft.scaleMmPerUnit || 1;
    if (img) return { w: img.naturalWidth * sc, h: img.naturalHeight * sc };
    return { w: 600, h: 760 };
  }, [img, draft.scaleMmPerUnit]);

  const t: T = useMemo(() => {
    const pad = 56;
    const pxPerMM = Math.max(
      0.02,
      Math.min((size.width - 2 * pad) / flatMm.w, (size.height - 2 * pad) / flatMm.h),
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

  const sleeve = isSleeveKind(draft.viewKind);

  // Калибровка: клик двух точек.
  const measureDist =
    pts.length === 2 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : null;

  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!measure) return;
    const stage = stageRef.current;
    const p = stage?.getPointerPosition();
    if (!p) return;
    const m = { x: t.toMmX(p.x), y: t.toMmY(p.y) };
    setPts((prev) => (prev.length >= 2 ? [m] : [...prev, m]));
  };

  const applyCalibration = () => {
    const real = parseFloat(realLen.replace(",", "."));
    if (!measureDist || !(real > 0)) return;
    onChange({ scaleMmPerUnit: (draft.scaleMmPerUnit || 1) * (real / measureDist) });
    setMeasure(false);
    setPts([]);
    setRealLen("");
  };

  // Зона: Transformer.
  const zoneRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  useEffect(() => {
    if (trRef.current && zoneRef.current && !measure) {
      trRef.current.nodes([zoneRef.current]);
      trRef.current.getLayer()?.batchDraw();
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [measure, img]);

  const z = draft.zone;

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
            <KImage image={img} x={t.px(0)} y={t.py(0)} width={t.s(flatMm.w)} height={t.s(flatMm.h)} />
          )}
        </Layer>

        {/* Зона */}
        <Layer>
          <Rect
            ref={zoneRef}
            x={t.px(z.x)}
            y={t.py(z.y)}
            width={t.s(z.w)}
            height={t.s(z.h)}
            stroke="#4f8cff"
            strokeWidth={1.5}
            dash={[8, 6]}
            fill="rgba(79,140,255,0.08)"
            draggable={!measure}
            onDragEnd={(e) => {
              const n = e.target;
              onChange({ zone: { ...z, x: t.toMmX(n.x()), y: t.toMmY(n.y()) } });
            }}
            onTransformEnd={(e) => {
              const n = e.target as Konva.Rect;
              const w = Math.max(5, (n.width() * n.scaleX()) / t.pxPerMM);
              const h = Math.max(5, (n.height() * n.scaleY()) / t.pxPerMM);
              n.scaleX(1);
              n.scaleY(1);
              onChange({
                zone: { ...z, x: t.toMmX(n.x()), y: t.toMmY(n.y()), w, h },
              });
            }}
          />
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
          {!sleeve && (
            <>
              {/* Ось изделия (вертикаль) + ручка сверху */}
              <Line
                points={[t.px(draft.centerAxisX), t.py(0), t.px(draft.centerAxisX), t.py(flatMm.h)]}
                stroke="#39d98a"
                strokeWidth={1}
                dash={[5, 6]}
                listening={false}
              />
              <Handle
                x={t.px(draft.centerAxisX)}
                y={t.py(Math.max(10, draft.neckline.y - 40))}
                color="#39d98a"
                label="ось"
                draggable={!measure}
                onMove={(px) => onChange({ centerAxisX: t.toMmX(px.x) })}
              />
              {/* Горловина */}
              <Handle
                x={t.px(draft.neckline.x)}
                y={t.py(draft.neckline.y)}
                color="#ff5a5f"
                label="горловина"
                draggable={!measure}
                onMove={(px) =>
                  onChange({ neckline: { x: t.toMmX(px.x), y: t.toMmY(px.y) } })
                }
              />
            </>
          )}
          {sleeve && (
            <>
              <Line
                points={[t.px(0), t.py(draft.sleeveBottomY), t.px(flatMm.w), t.py(draft.sleeveBottomY)]}
                stroke="#ff5a5f"
                strokeWidth={1}
                dash={[5, 6]}
                listening={false}
              />
              <Handle
                x={t.px(draft.sleeveCenterX)}
                y={t.py(draft.sleeveBottomY)}
                color="#ff5a5f"
                label="низ/центр рукава"
                draggable={!measure}
                onMove={(px) =>
                  onChange({ sleeveCenterX: t.toMmX(px.x), sleeveBottomY: t.toMmY(px.y) })
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
              points={[t.px(pts[0].x), t.py(pts[0].y), t.px(pts[1].x), t.py(pts[1].y)]}
              stroke="#f59e0b"
              strokeWidth={1}
              dash={[4, 3]}
            />
          )}
        </Layer>
      </Stage>

      {/* Тулбар */}
      <div className="absolute left-3 top-3 flex flex-col gap-2">
        <button
          onClick={() => {
            setMeasure((v) => !v);
            setPts([]);
          }}
          className={`rounded-md px-2.5 py-1 text-xs font-medium shadow ${
            measure ? "bg-amber-500 text-black" : "bg-neutral-800/90 text-neutral-300 hover:bg-neutral-700"
          }`}
        >
          Калибровка{measureDist != null ? ` · ${measureDist.toFixed(1)} мм` : ""}
        </button>
        {measure && measureDist != null && (
          <div className="w-56 rounded-md border border-neutral-700 bg-neutral-900/95 p-2.5 text-xs">
            <div className="mb-1 text-neutral-400">
              Измерено {measureDist.toFixed(1)} мм (текущий масштаб)
            </div>
            <input
              type="number"
              value={realLen}
              onChange={(e) => setRealLen(e.target.value)}
              placeholder="реальная длина, мм"
              className="mb-2 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1"
            />
            <button
              onClick={applyCalibration}
              className="w-full rounded bg-emerald-600 px-2 py-1 font-medium text-white hover:bg-emerald-500"
            >
              Применить масштаб
            </button>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/50 px-2 py-1 text-xs text-neutral-300">
        флэт {Math.round(flatMm.w)}×{Math.round(flatMm.h)} мм · scale{" "}
        {draft.scaleMmPerUnit.toFixed(3)} мм/ед · {t.pxPerMM.toFixed(2)} px/мм
      </div>
    </div>
  );
}

/** Перетаскиваемая ручка-маркер с подписью. */
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
      <Circle radius={6} fill={color} stroke="#0b0d10" strokeWidth={1.5} />
      <Text x={9} y={-6} text={label} fontSize={11} fill={color} />
    </Group>
  );
}
