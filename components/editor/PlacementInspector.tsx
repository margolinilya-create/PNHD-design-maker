"use client";

import { useEffect, useState } from "react";
import {
  placementInfo,
  presetPosition,
  fitToZone,
  yForNecklineOffset,
  positionOnAxis,
  anchorsForSize,
  findPrintArea,
  type PositionPreset,
} from "@/lib/geometry/view";
import { printQuality } from "@/lib/catalog/dpi";
import {
  PRINT_METHOD_LIST,
  printMethodProfile,
  resolveMethod,
  methodAllowedInZone,
} from "@/lib/catalog/printMethod";
import type { Asset, Placement, View } from "@/types";
import {
  TriangleAlert,
  FlipVertical2,
  FlipHorizontal2,
  RotateCcw,
  RotateCw,
} from "lucide-react";

/**
 * Точное позиционирование выбранного нанесения: числовые поля в мм/градусах
 * с двусторонней привязкой к updatePlacement.
 */
export function PlacementInspector({
  placement: p,
  view,
  views,
  accessory,
  garmentSize,
  asset,
  onChange,
  onDuplicate,
  onDuplicateAll,
  onCopyToView,
  onMirror,
}: {
  placement: Placement;
  view: View | undefined;
  views: View[];
  /** Аксессуар (шоппер): нет горловины — пресеты «от горловины» скрыты. */
  accessory: boolean;
  garmentSize: string | null;
  asset: Asset | undefined;
  onChange: (patch: Partial<Placement>) => void;
  onDuplicate: () => void;
  onDuplicateAll: () => void;
  onCopyToView: (viewId: string) => void;
  onMirror: () => void;
}) {
  const isSleeve = view?.kind === "sleeve_left" || view?.kind === "sleeve_right";
  const otherViews = views.filter((v) => v.id !== view?.id);
  // Зона с учётом per-size набора текущего размера.
  const area = view
    ? findPrintArea(view, p.print_area_id, garmentSize ?? undefined)
    : undefined;
  const method = resolveMethod(p.method, area?.default_method);
  const profile = printMethodProfile(method);
  const methodConflict = !methodAllowedInZone(area, method);
  const applyPreset = (preset: PositionPreset) => {
    if (!view) return;
    const pos = presetPosition(
      view,
      { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
      preset,
      garmentSize ?? undefined,
      p.print_area_id,
    );
    onChange(pos);
  };
  const applyFit = (mode: "fit" | "fill") => {
    if (!view) return;
    onChange(
      fitToZone(
        view,
        { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
        mode,
        garmentSize ?? undefined,
        p.print_area_id,
      ),
    );
  };
  const isFrontBack =
    view?.kind === "front" || view?.kind === "back";
  // Отступ от шва горловины (знаковый, мм) — вводимое поле для front/back.
  const neckInfo =
    view && isFrontBack
      ? placementInfo(
          view,
          { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
          p.rotation_deg,
          garmentSize ?? undefined,
          p.print_area_id,
        )
      : null;
  const neckOffset =
    neckInfo?.anchor.kind === "neckline" ? neckInfo.anchor.vertical : null;
  const commitNeckOffset = (v: number) => {
    if (!view) return;
    onChange({
      y_mm: yForNecklineOffset(
        view,
        { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
        p.rotation_deg,
        v,
        garmentSize ?? undefined,
        p.print_area_id,
      ),
    });
  };
  const presets: { key: PositionPreset; label: string }[] = [
    { key: "center-x", label: "Центр X" },
    { key: "center-zone", label: "Центр зоны" },
    { key: "top", label: "Вверх" },
    { key: "bottom", label: "Вниз" },
    // Стандарты от горловины — только для front/back одежды (не аксессуаров).
    ...(isFrontBack && !accessory
      ? ([
          { key: "chest-standard", label: "Грудь (3″)" },
          { key: "left-chest", label: "Лев. грудь" },
        ] as { key: PositionPreset; label: string }[])
      : []),
  ];
  // Именованные вертикальные оси вида (выточки/рельефы) → пресеты «Центр: …».
  const namedAxes = view
    ? (garmentSize ? anchorsForSize(view, garmentSize) : view.anchors).axes ?? []
    : [];
  const applyAxis = (axisId: string) => {
    if (!view) return;
    const pos = positionOnAxis(
      view,
      { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
      axisId,
      garmentSize ?? undefined,
    );
    if (pos) onChange(pos);
  };
  return (
    <section>
      <h3 className="mb-2 font-semibold text-ink">Позиция (мм)</h3>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {presets.map((pr) => (
          <button
            key={pr.key}
            onClick={() => applyPreset(pr.key)}
            className="rounded bg-raised px-2 py-1 text-xs text-ink hover:bg-gray-200"
          >
            {pr.label}
          </button>
        ))}
        {namedAxes.map((a) => (
          <button
            key={a.id}
            onClick={() => applyAxis(a.id)}
            title={`Центрировать по оси «${a.name}» (X=${a.x} мм)`}
            className="rounded bg-raised px-2 py-1 text-xs text-ink hover:bg-gray-200"
          >
            Центр: {a.name}
          </button>
        ))}
        <button
          onClick={() => applyFit("fit")}
          title="Вписать в зону (по safe-зоне)"
          className="rounded bg-raised px-2 py-1 text-xs text-ink hover:bg-gray-200"
        >
          Вписать
        </button>
        <button
          onClick={() => applyFit("fill")}
          title="Заполнить зону (излишек обрежется)"
          className="rounded bg-raised px-2 py-1 text-xs text-ink hover:bg-gray-200"
        >
          Заполнить
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MmField
          label="X"
          value={p.x_mm}
          onCommit={(v) => onChange({ x_mm: v })}
        />
        <MmField
          label="Y"
          value={p.y_mm}
          onCommit={(v) => onChange({ y_mm: v })}
        />
        {neckOffset !== null && (
          <MmField
            label="Отступ от горловины"
            value={neckOffset}
            onCommit={commitNeckOffset}
          />
        )}
        <MmField
          label="Ширина"
          value={p.width_mm}
          min={1}
          onCommit={(v) => onChange({ width_mm: Math.max(1, v) })}
        />
        <MmField
          label="Высота"
          value={p.height_mm}
          min={1}
          onCommit={(v) => onChange({ height_mm: Math.max(1, v) })}
        />
        <MmField
          label="Поворот°"
          value={p.rotation_deg}
          onCommit={(v) => onChange({ rotation_deg: v })}
        />
      </div>
      {/* Трансформ: флип / поворот на 90° */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button onClick={() => onChange({ flip_h: !p.flip_h })} className={`${tbtn(p.flip_h)} inline-flex items-center gap-1`}><FlipHorizontal2 size={13} strokeWidth={1.75} /> Флип</button>
        <button onClick={() => onChange({ flip_v: !p.flip_v })} className={`${tbtn(p.flip_v)} inline-flex items-center gap-1`}><FlipVertical2 size={13} strokeWidth={1.75} /> Флип</button>
        <button onClick={() => onChange({ rotation_deg: (p.rotation_deg - 90 + 360) % 360 })} className={`${tbtn(false)} inline-flex items-center gap-1`}><RotateCcw size={13} strokeWidth={1.75} /> 90°</button>
        <button onClick={() => onChange({ rotation_deg: (p.rotation_deg + 90) % 360 })} className={`${tbtn(false)} inline-flex items-center gap-1`}><RotateCw size={13} strokeWidth={1.75} /> 90°</button>
      </div>

      {/* Действия: дубль / копия на вид / зеркало рукава */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button onClick={onDuplicate} className={tbtn(false)}>Дублировать</button>
        <button onClick={onDuplicateAll} className={tbtn(false)} title="Копия в каждую печатную зону всех видов">На все зоны</button>
        {isSleeve && <button onClick={onMirror} className={tbtn(false)}>Зеркало рукава</button>}
        {otherViews.length > 0 && (
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onCopyToView(e.target.value);
              e.target.value = "";
            }}
            className="rounded border border-line bg-white px-2 py-1 text-xs text-ink"
          >
            <option value="">Копировать на вид…</option>
            {otherViews.map((v) => (
              <option key={v.id} value={v.id}>{v.kind}</option>
            ))}
          </select>
        )}
      </div>

      {/* Метод печати — задаёт профиль качества и production-вывод */}
      <div className="mt-3 border-t border-line pt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-gray-500">Метод печати</span>
          <span className="text-[10px] text-gray-400">
            {profile.colorMode === "spot" ? "spot / Pantone" : "CMYK"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRINT_METHOD_LIST.map((m) => {
            // Недопустимые для зоны методы затемняем, но не блокируем —
            // решение за оператором (preflight предупредит).
            const allowed = methodAllowedInZone(area, m.id);
            return (
              <button
                key={m.id}
                onClick={() => onChange({ method: m.id })}
                title={
                  allowed ? m.label : `${m.label} — недопустим в этой зоне`
                }
                className={`rounded px-2.5 py-1 text-xs ${
                  m.id === method
                    ? "bg-blue-600 text-white"
                    : "bg-raised text-gray-700 hover:bg-gray-200"
                } ${allowed ? "" : "opacity-40"}`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        {methodConflict && (
          <p className="mt-1.5 flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
            <TriangleAlert size={12} strokeWidth={2} className="shrink-0" />
            Метод «{profile.label}» не входит в допустимые для зоны «
            {area?.name}».
          </p>
        )}
      </div>

      {/* Спецификация для цеха: допуск ± и «как мерить» (P1 #13) */}
      <div className="mt-3 border-t border-line pt-3">
        <span className="mb-1 block text-xs text-gray-500">
          Спецификация (печатается в обвязке)
        </span>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <MmField
            label="Допуск ± мм"
            value={p.tolerance_mm ?? 0}
            min={0}
            onCommit={(v) => onChange({ tolerance_mm: v > 0 ? v : undefined })}
          />
        </div>
        <label className="mb-1 block text-xs text-gray-500">
          Как мерить (HTM)
        </label>
        <input
          value={p.htm ?? ""}
          onChange={(e) => onChange({ htm: e.target.value || undefined })}
          placeholder="напр. от шва горловины до верха принта"
          className="w-full rounded border border-line bg-white px-2 py-1.5 text-xs"
        />
      </div>

      {asset?.size_estimated && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
          размер оценочно — уточните Ш×В
        </p>
      )}
      <DpiBadge asset={asset} printWidthMm={p.width_mm} method={method} />
    </section>
  );
}

const tbtn = (active?: boolean) =>
  `rounded px-2 py-1 text-xs ${active ? "bg-blue-600 text-white" : "bg-raised text-ink hover:bg-gray-200"}`;

/** Индикатор качества печати на текущем размере макета (с учётом метода). */
function DpiBadge({
  asset,
  printWidthMm,
  method,
}: {
  asset: Asset | undefined;
  printWidthMm: number;
  method?: import("@/types").PrintMethod;
}) {
  const { quality, dpi } = printQuality(asset, printWidthMm, method);
  if (quality === "unknown") return null;
  const profile = printMethodProfile(method);
  if (quality === "embroidery") {
    const d = profile.detail!;
    return (
      <p className="mt-2 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
        вышивка — проверьте мин. деталь: линия ≥ {d.minLineMm} мм, текст ≥{" "}
        {d.minTextMm} мм (диджитайз вне инструмента)
      </p>
    );
  }
  const good = profile.dpi?.good ?? 300;
  const map: Record<string, { cls: string; text: string }> = {
    vector: {
      cls: "bg-emerald-50 text-emerald-700",
      text: "вектор — без потери качества",
    },
    good: {
      cls: "bg-emerald-50 text-emerald-700",
      text: `${Math.round(dpi ?? 0)} DPI — отличное качество`,
    },
    mid: {
      cls: "bg-amber-50 text-amber-700",
      text: `${Math.round(dpi ?? 0)} DPI — приемлемо (уменьшите макет для ${good}+)`,
    },
    low: {
      cls: "bg-red-50 text-red-700",
      text: `${Math.round(dpi ?? 0)} DPI — низкое качество, печать размыта`,
    },
  };
  const m = map[quality];
  return <p className={`mt-2 rounded px-2 py-1 text-xs ${m.cls}`}>{m.text}</p>;
}

/**
 * Числовое поле в мм с локальным буфером ввода:
 * правки фиксируются по blur/Enter, при этом поле синхронизируется,
 * когда значение в сторе меняется извне (drag/стрелки на холсте).
 */
function MmField({
  label,
  value,
  min,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(() => round1(value));
  const [editing, setEditing] = useState(false);

  // Пока поле не редактируется — следуем за внешним значением.
  useEffect(() => {
    if (!editing) setDraft(round1(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const n = parseFloat(draft.replace(",", "."));
    if (Number.isFinite(n)) {
      onCommit(min != null ? Math.max(min, n) : n);
    } else {
      setDraft(round1(value));
    }
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        type="number"
        step={1}
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="w-full rounded border border-line bg-white px-2 py-1.5 tabular-nums"
      />
    </label>
  );
}

/** Округление до 0.1 мм в строку (для поля ввода). */
function round1(v: number): string {
  return String(Math.round(v * 10) / 10);
}
