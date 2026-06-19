// Координаты печатной зоны на фото-мокапе. mockup.print нормирован (доли фото):
// x,y — левый-верх зоны (доли ширины/высоты фото), w — ширина (доля ширины).
// Высота зоны выводится из аспекта печатной зоны (zoneAspect = zh/zw).
export interface PrintNorm {
  x: number;
  y: number;
  w: number;
}

export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Нормированный print → прямоугольник в пикселях фото. */
export function printToPxRect(
  p: PrintNorm,
  imgW: number,
  imgH: number,
  zoneAspect: number,
): PxRect {
  const w = p.w * imgW;
  return { x: p.x * imgW, y: p.y * imgH, w, h: w * zoneAspect };
}

/** Прямоугольник в пикселях фото → нормированный print (высота не хранится). */
export function pxRectToPrint(
  r: { x: number; y: number; w: number },
  imgW: number,
  imgH: number,
): PrintNorm {
  return { x: r.x / imgW, y: r.y / imgH, w: r.w / imgW };
}

/** Аспект печатной зоны (высота/ширина) из её AABB в мм. */
export function zoneAspectFromBbox(zw: number, zh: number): number {
  return zw > 0 ? zh / zw : 1;
}
