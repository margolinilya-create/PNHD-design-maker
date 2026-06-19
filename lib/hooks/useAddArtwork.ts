"use client";

import { useCallback } from "react";
import { useProjectStore } from "@/lib/state/projectStore";
import { loadAsset } from "@/lib/catalog/loadAsset";
import { viewZone, printAreasForSize } from "@/lib/geometry/view";

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Добавить макет из файла: грузит ассет, кладёт нанесение в зону.
 * Если задан `at` (мм) — центрирует по точке (drag-n-drop), иначе по центру зоны.
 * `areaId` — целевая зона (для мультизонных видов).
 */
export function useAddArtwork() {
  const addAsset = useProjectStore((s) => s.addAsset);
  const addPlacement = useProjectStore((s) => s.addPlacement);

  return useCallback(
    async (
      file: File,
      opts?: { at?: { xMm: number; yMm: number }; areaId?: string },
    ) => {
      const st = useProjectStore.getState();
      const view = st.currentView();
      if (!view) return;
      const size = st.size ?? undefined;
      const areas = printAreasForSize(view, size);
      const areaId =
        opts?.areaId && areas.some((a) => a.id === opts.areaId)
          ? opts.areaId
          : areas[0].id;
      const area = areas.find((a) => a.id === areaId);
      const { zone } = viewZone(view, size, areaId);

      const loaded = await loadAsset(file);
      const assetId = addAsset({
        type: loaded.type,
        source_file: loaded.source_file,
        data_url: loaded.dataUrl,
        intrinsic_size_mm: loaded.intrinsic_size_mm,
        px_width: loaded.naturalWidth,
        px_height: loaded.naturalHeight,
        dpi: loaded.dpi,
        size_estimated: loaded.size_estimated,
      });

      const maxW = zone.zw * 0.7;
      const aspect =
        loaded.intrinsic_size_mm.height / loaded.intrinsic_size_mm.width || 1;
      const w = Math.min(loaded.intrinsic_size_mm.width, maxW);
      const h = w * aspect;

      const x = opts?.at
        ? clamp(opts.at.xMm - w / 2, zone.zx, zone.zx + zone.zw - w)
        : zone.zx + (zone.zw - w) / 2;
      const y = opts?.at
        ? clamp(opts.at.yMm - h / 2, zone.zy, zone.zy + zone.zh - h)
        : zone.zy + (zone.zh - h) / 2;

      addPlacement({
        print_area_id: areaId,
        asset_id: assetId,
        x_mm: x,
        y_mm: y,
        width_mm: w,
        height_mm: h,
        rotation_deg: 0,
        method: area?.default_method,
      });
    },
    [addAsset, addPlacement],
  );
}
