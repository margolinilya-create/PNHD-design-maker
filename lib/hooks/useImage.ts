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
    img.crossOrigin = "anonymous";
    let active = true;
    img.onload = () => {
      if (active) setImage(img);
    };
    img.src = src;
    return () => {
      active = false;
    };
  }, [src]);

  return image;
}
