"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { Stage, Layer, Image as KImage, Rect, Text, Transformer } from "react-konva";
import { useImage } from "@/lib/hooks/useImage";
import {
  printToPxRect,
  pxRectToPrint,
  type PrintNorm,
} from "@/lib/admin/mockupGeom";

/**
 * Визуальное позиционирование печатной зоны на фото-мокапе: фон = фото,
 * перетаскиваемая/масштабируемая рамка = зона. Координаты — нормированные доли
 * фото; высота рамки выводится из аспекта печатной зоны (keepRatio держит его).
 */
export function MockupZoneCanvas({
  photo,
  print,
  zoneAspect,
  onChange,
}: {
  photo: string;
  print: PrintNorm;
  zoneAspect: number;
  onChange: (print: PrintNorm) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 240 });
  const img = useImage(photo || null);

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

  const imgW = img?.naturalWidth || 1;
  const imgH = img?.naturalHeight || 1;

  // Вписать фото в контейнер (contain) + смещение центрирования.
  const fit = useMemo(() => {
    const s = Math.min(size.width / imgW, size.height / imgH) || 0.01;
    return {
      s,
      ox: (size.width - imgW * s) / 2,
      oy: (size.height - imgH * s) / 2,
    };
  }, [size, imgW, imgH]);

  // Рамка зоны: фото-пиксели → экран.
  const r = printToPxRect(print, imgW, imgH, zoneAspect);
  const screen = {
    x: fit.ox + r.x * fit.s,
    y: fit.oy + r.y * fit.s,
    w: r.w * fit.s,
    h: r.h * fit.s,
  };

  const rectRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  useEffect(() => {
    const tr = trRef.current;
    if (tr && rectRef.current && img) {
      tr.nodes([rectRef.current]);
      tr.getLayer()?.batchDraw();
    }
  }, [img]);

  // Экран → фото-пиксели → нормированный print.
  const commit = (sx: number, sy: number, sw: number) => {
    onChange(
      pxRectToPrint(
        { x: (sx - fit.ox) / fit.s, y: (sy - fit.oy) / fit.s, w: sw / fit.s },
        imgW,
        imgH,
      ),
    );
  };

  return (
    <div ref={containerRef} className="relative h-56 w-full rounded bg-shell">
      <Stage width={size.width} height={size.height}>
        <Layer listening={false}>
          {img && (
            <KImage
              image={img}
              x={fit.ox}
              y={fit.oy}
              width={imgW * fit.s}
              height={imgH * fit.s}
            />
          )}
        </Layer>
        <Layer>
          <Rect
            ref={rectRef}
            x={screen.x}
            y={screen.y}
            width={screen.w}
            height={screen.h}
            stroke="#4f8cff"
            strokeWidth={1.5}
            dash={[6, 4]}
            fill="rgba(79,140,255,0.12)"
            draggable
            onDragEnd={(e) => commit(e.target.x(), e.target.y(), screen.w)}
            onTransformEnd={(e) => {
              const n = e.target as Konva.Rect;
              const sw = Math.max(8, n.width() * n.scaleX());
              n.scaleX(1);
              n.scaleY(1);
              commit(n.x(), n.y(), sw);
            }}
          />
          <Text
            x={screen.x + 3}
            y={screen.y + 3}
            text="зона печати"
            fontSize={11}
            fill="#bcd0ff"
            listening={false}
          />
          <Transformer
            ref={trRef}
            keepRatio
            rotateEnabled={false}
            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
            boundBoxFunc={(o, nb) => (nb.width < 12 ? o : nb)}
          />
        </Layer>
      </Stage>
      {!img && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-400">
          загрузка фото…
        </span>
      )}
    </div>
  );
}
