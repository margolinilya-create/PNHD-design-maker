"use client";

import { useEffect, useState } from "react";
import {
  resolveFlatMarkup,
  svgToDataUrl,
  recolorGarment,
} from "@/lib/export/flatMarkup";

/**
 * Возвращает data URL флэта с силуэтом, перекрашенным в `color`.
 * Без цвета — исходный src. Загрузка/перекраска асинхронные.
 */
export function useColoredFlat(src: string | null, color: string): string | null {
  const [out, setOut] = useState<string | null>(src);
  useEffect(() => {
    let active = true;
    if (!src) {
      setOut(null);
      return;
    }
    if (!color) {
      setOut(src);
      return;
    }
    // Растровый флэт (PNG/JPG data URL) перекрасить нельзя — regex-замена
    // вернула бы мусор, и <img> не загрузился бы. Отдаём исходник как есть.
    if (src.startsWith("data:") && !src.startsWith("data:image/svg")) {
      setOut(src);
      return;
    }
    resolveFlatMarkup(src)
      .then((svg) => {
        if (!active) return;
        // Страховка для сетевых URL: перекрашиваем только настоящий SVG.
        setOut(/<svg[\s>]/i.test(svg) ? svgToDataUrl(recolorGarment(svg, color)) : src);
      })
      .catch(() => {
        if (active) setOut(src);
      });
    return () => {
      active = false;
    };
  }, [src, color]);
  return out;
}
