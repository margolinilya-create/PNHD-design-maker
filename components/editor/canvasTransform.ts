/** Линейная развёртка мм → px стейджа. */
export interface Transform {
  px: (xMm: number) => number;
  py: (yMm: number) => number;
  s: (mm: number) => number;
  pxPerMM: number;
}
