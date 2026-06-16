"use client";

import { useEffect, useState } from "react";

/** Загружает HTMLImageElement по URL (для Konva.Image). */
export function useImage(src: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    // crossOrigin нужен только для http/https (CORS-картинки на canvas);
    // для data: URL атрибут не ставим — иначе часть браузеров ломает загрузку.
    if (/^https?:/i.test(src)) {
      img.crossOrigin = "anonymous";
    }
    let active = true;
    img.onload = () => {
      if (active) setImage(img);
    };
    img.onerror = () => {
      // На ошибке загрузки сбрасываем картинку в null.
      if (active) setImage(null);
    };
    img.src = src;
    return () => {
      active = false;
    };
  }, [src]);

  return image;
}
