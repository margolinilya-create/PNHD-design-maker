"use client";

import { useMemo } from "react";
import { placementInfo, findPrintArea } from "@/lib/geometry/view";
import { printQuality } from "@/lib/catalog/dpi";
import { printMethodProfile, resolveMethod } from "@/lib/catalog/printMethod";
import type { Asset, Placement, View } from "@/types";
import {
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Copy,
  X,
} from "lucide-react";

function findViewForPlacementName(view: View | undefined, p: Placement): string {
  return (
    p.name ||
    view?.print_areas.find((a) => a.id === p.print_area_id)?.name ||
    "Слой"
  );
}

/** Строка слоя: превью, имя, DPI, порядок/скрыть/блок/дубль/удалить. */
export function LayerRow({
  placement: p,
  view,
  asset,
  garmentSize,
  selected,
  onSelect,
  onRemove,
  onDup,
  onUp,
  onDown,
  onToggleHidden,
  onToggleLocked,
  onRename,
}: {
  placement: Placement;
  view: View | undefined;
  asset: Asset | undefined;
  garmentSize: string | null;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDup: () => void;
  onUp: () => void;
  onDown: () => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onRename: (name: string) => void;
}) {
  const out = useMemo(
    () =>
      view
        ? placementInfo(
            view,
            { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
            p.rotation_deg,
            garmentSize ?? undefined,
            p.print_area_id,
          ).check.out_of_zone
        : false,
    [view, p.x_mm, p.y_mm, p.width_mm, p.height_mm, p.rotation_deg, p.print_area_id, garmentSize],
  );
  // Зона с учётом per-size набора текущего размера.
  const area = view
    ? findPrintArea(view, p.print_area_id, garmentSize ?? undefined)
    : undefined;
  const method = resolveMethod(p.method, area?.default_method);
  const profile = printMethodProfile(method);
  const { quality, dpi } = printQuality(asset, p.width_mm, method);
  const dpiColor =
    quality === "low" ? "text-red-600" : quality === "mid" ? "text-amber-600" : "text-gray-400";
  const qualityLabel =
    quality === "vector"
      ? "вектор"
      : quality === "embroidery"
        ? "деталь"
        : dpi
          ? `${Math.round(dpi)}dpi`
          : "";

  const icon = "rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-200 hover:text-ink";
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-2 transition ${
        selected ? "border-blue-500 bg-raised" : "border-line bg-white hover:border-gray-300"
      } ${p.hidden ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset?.data_url}
          alt=""
          className="h-8 w-8 shrink-0 rounded bg-shell object-contain"
        />
        <input
          value={findViewForPlacementName(view, p)}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onRename(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none focus:rounded focus:bg-white focus:px-1"
        />
        <span
          className="shrink-0 rounded bg-raised px-1 text-[9px] text-gray-500"
          title={profile.label}
        >
          {profile.short}
        </span>
        <span className={`shrink-0 text-[10px] tabular-nums ${dpiColor}`}>
          {qualityLabel}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-0.5 text-xs">
        <button onClick={(e) => { e.stopPropagation(); onUp(); }} title="Выше" className={icon}><ChevronUp size={14} strokeWidth={1.75} /></button>
        <button onClick={(e) => { e.stopPropagation(); onDown(); }} title="Ниже" className={icon}><ChevronDown size={14} strokeWidth={1.75} /></button>
        <button onClick={(e) => { e.stopPropagation(); onToggleHidden(); }} title="Скрыть" className={icon}>{p.hidden ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}</button>
        <button onClick={(e) => { e.stopPropagation(); onToggleLocked(); }} title="Блокировать" className={icon}>{p.locked ? <Lock size={14} strokeWidth={1.75} /> : <LockOpen size={14} strokeWidth={1.75} />}</button>
        <button onClick={(e) => { e.stopPropagation(); onDup(); }} title="Дублировать" className={icon}><Copy size={14} strokeWidth={1.75} /></button>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Удалить" className={`${icon} hover:text-red-600`}><X size={14} strokeWidth={1.75} /></button>
        {out && <span className="ml-auto rounded bg-red-50 px-1 text-[10px] text-red-700">за зоной</span>}
      </div>
    </div>
  );
}
