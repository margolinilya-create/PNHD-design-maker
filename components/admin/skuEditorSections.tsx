"use client";

// Мелкие секции и поля формы редактора SKU (вынесены из SkuEditor.tsx).
// Логика и разметка перенесены без изменений.

import type { GradeRule, ViewKind } from "@/types";

export const VIEW_KINDS: { value: ViewKind; label: string }[] = [
  { value: "front", label: "перёд" },
  { value: "back", label: "спина" },
  { value: "sleeve_left", label: "рукав (л)" },
  { value: "sleeve_right", label: "рукав (п)" },
  { value: "label_neck_inner", label: "этикетка (внутр.)" },
  { value: "label_neck_outer", label: "этикетка (внеш.)" },
];

export function GradeRuleEditor({
  rule,
  isSleeve,
  accessory,
  onChange,
}: {
  rule: GradeRule | undefined;
  isSleeve: boolean;
  /** Аксессуар: дельты горловины не показываем (горловины нет). */
  accessory?: boolean;
  onChange: (r: GradeRule | undefined) => void;
}) {
  const set = (patch: Partial<GradeRule>) => {
    const next: GradeRule = { ...rule, ...patch };
    const empty =
      !next.neckline?.dx &&
      !next.neckline?.dy &&
      !next.center_axis_dx &&
      !next.sleeve_bottom_dy &&
      !next.sleeve_center_dx;
    onChange(empty ? undefined : next);
  };
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {isSleeve ? (
        <>
          <NumField
            label="Δ низ рукава Y"
            value={rule?.sleeve_bottom_dy ?? 0}
            onChange={(n) => set({ sleeve_bottom_dy: n })}
          />
          <NumField
            label="Δ центр рукава X"
            value={rule?.sleeve_center_dx ?? 0}
            onChange={(n) => set({ sleeve_center_dx: n })}
          />
        </>
      ) : (
        <>
          {!accessory && (
            <>
              <NumField
                label="Δ горловина Y"
                value={rule?.neckline?.dy ?? 0}
                onChange={(n) => set({ neckline: { ...rule?.neckline, dy: n } })}
              />
              <NumField
                label="Δ горловина X"
                value={rule?.neckline?.dx ?? 0}
                onChange={(n) => set({ neckline: { ...rule?.neckline, dx: n } })}
              />
            </>
          )}
          <NumField
            label="Δ ось центра X"
            value={rule?.center_axis_dx ?? 0}
            onChange={(n) => set({ center_axis_dx: n })}
          />
        </>
      )}
    </div>
  );
}

export function AddViewSelect({ onAdd }: { onAdd: (k: ViewKind) => void }) {
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value as ViewKind);
        e.target.value = "";
      }}
      className="rounded border border-line bg-shell px-2 py-1.5 text-sm"
    >
      <option value="">+ добавить вид…</option>
      {VIEW_KINDS.map((k) => (
        <option key={k.value} value={k.value}>
          {k.label}
        </option>
      ))}
    </select>
  );
}

export function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-gray-400">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-line bg-shell px-1.5 py-1 text-xs tabular-nums"
      />
    </label>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-semibold text-ink">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}
