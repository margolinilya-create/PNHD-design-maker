"use client";

// Редактор печатной зоны (вынесен из SkuEditor.tsx без изменений логики).

import { zoneRect } from "@/lib/admin/skuEdit";
import { PRINT_METHOD_LIST } from "@/lib/catalog/printMethod";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import type { PrintArea } from "@/types";
import { NumField } from "./skuEditorSections";

export function ZoneEditor({
  area,
  perSize,
  canRemove,
  canMoveUp,
  canMoveDown,
  selected,
  onSelect,
  onRect,
  onMeta,
  onRemove,
  onMove,
}: {
  area: PrintArea;
  perSize: boolean;
  canRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  selected: boolean;
  onSelect: () => void;
  onRect: (rect: { x: number; y: number; w: number; h: number }) => void;
  onMeta: (patch: Partial<PrintArea>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const r = zoneRect(area);
  const setRect = (p: Partial<{ x: number; y: number; w: number; h: number }>) =>
    onRect({ ...r, ...p });
  // Лимиты печати: 0/пусто = нет ограничения (в схеме поля positive-optional).
  const setLimit = (
    key: "max_print_mm" | "min_print_mm",
    axis: "width" | "height",
    n: number,
  ) => {
    const cur = area[key];
    const next = { width: cur?.width ?? 0, height: cur?.height ?? 0, [axis]: n };
    onMeta({
      [key]:
        next.width > 0 && next.height > 0
          ? { width: next.width, height: next.height }
          : undefined,
    });
  };
  return (
    <div
      onClick={onSelect}
      className={`rounded border bg-white p-2 ${
        selected ? "border-blue-500" : "border-line"
      }`}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <input
          value={area.name}
          onChange={(e) => onMeta({ name: e.target.value })}
          disabled={perSize}
          className="flex-1 rounded border border-line bg-shell px-2 py-1 text-sm disabled:opacity-60"
        />
        {!perSize && (
          <>
            <button
              onClick={() => onMove(-1)}
              disabled={!canMoveUp}
              title="Выше"
              className="text-gray-400 hover:text-ink disabled:opacity-30"
            >
              <ChevronUp size={14} strokeWidth={1.75} />
            </button>
            <button
              onClick={() => onMove(1)}
              disabled={!canMoveDown}
              title="Ниже"
              className="text-gray-400 hover:text-ink disabled:opacity-30"
            >
              <ChevronDown size={14} strokeWidth={1.75} />
            </button>
          </>
        )}
        {canRemove && (
          <button onClick={onRemove} className="text-gray-400 hover:text-red-600">
            <X size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <NumField label="X" value={r.x} onChange={(n) => setRect({ x: n })} />
        <NumField label="Y" value={r.y} onChange={(n) => setRect({ y: n })} />
        <NumField label="Ш" value={r.w} onChange={(n) => setRect({ w: Math.max(1, n) })} />
        <NumField label="В" value={r.h} onChange={(n) => setRect({ h: Math.max(1, n) })} />
      </div>
      {!perSize && (
        <>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <NumField
              label="safe-inset"
              value={area.safe_inset_mm}
              onChange={(n) => onMeta({ safe_inset_mm: Math.max(0, n) })}
            />
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400">метод по умолч.</span>
              <select
                value={area.default_method ?? ""}
                onChange={(e) =>
                  onMeta({
                    default_method: (e.target.value || undefined) as
                      | PrintArea["default_method"],
                  })
                }
                className="rounded border border-line bg-shell px-1.5 py-1 text-xs"
              >
                <option value="">— нет —</option>
                {PRINT_METHOD_LIST.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {/* Допустимые методы зоны: сняты все/отмечены все = без ограничений. */}
          <div className="mt-1.5">
            <div className="mb-1 text-[10px] text-gray-400">
              Допустимые методы (все отмечены = без ограничений)
            </div>
            <div className="flex flex-wrap gap-2">
              {PRINT_METHOD_LIST.map((m) => {
                const all = PRINT_METHOD_LIST.map((x) => x.id);
                const cur = area.methods?.length ? area.methods : all;
                const toggle = () => {
                  const next = cur.includes(m.id)
                    ? cur.filter((x) => x !== m.id)
                    : [...cur, m.id];
                  // Пусто или полный набор → без ограничений (undefined).
                  const methods =
                    next.length === 0 || next.length === all.length
                      ? undefined
                      : next;
                  onMeta({
                    methods,
                    // Дефолтный метод не может выпасть из допустимых.
                    ...(area.default_method &&
                    methods &&
                    !methods.includes(area.default_method)
                      ? { default_method: undefined }
                      : {}),
                  });
                };
                return (
                  <label
                    key={m.id}
                    className="flex items-center gap-1 text-xs text-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={cur.includes(m.id)}
                      onChange={toggle}
                    />
                    {m.short}
                  </label>
                );
              })}
            </div>
          </div>
          {/* Лимиты размера печати — preflight предупреждает при выходе. */}
          <div className="mt-1.5">
            <div className="mb-1 text-[10px] text-gray-400">
              Лимиты печати (мм), 0 = без ограничения
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <NumField
                label="макс Ш"
                value={area.max_print_mm?.width ?? 0}
                onChange={(n) => setLimit("max_print_mm", "width", Math.max(0, n))}
              />
              <NumField
                label="макс В"
                value={area.max_print_mm?.height ?? 0}
                onChange={(n) => setLimit("max_print_mm", "height", Math.max(0, n))}
              />
              <NumField
                label="мин Ш"
                value={area.min_print_mm?.width ?? 0}
                onChange={(n) => setLimit("min_print_mm", "width", Math.max(0, n))}
              />
              <NumField
                label="мин В"
                value={area.min_print_mm?.height ?? 0}
                onChange={(n) => setLimit("min_print_mm", "height", Math.max(0, n))}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
