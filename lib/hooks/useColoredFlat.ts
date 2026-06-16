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
    resolveFlatMarkup(src)
      .then((svg) => {
        if (active) setOut(svgToDataUrl(recolorGarment(svg, color)));
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
