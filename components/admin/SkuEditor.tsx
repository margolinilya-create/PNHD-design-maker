"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { loadAsset } from "@/lib/catalog/loadAsset";
import {
  validateSku,
  addSize,
  removeSize,
  addView,
  removeView,
  addZone,
  removeZone,
  updateZone,
  updateView,
  zoneRect,
  rectZone,
  setGradeRule,
} from "@/lib/admin/skuEdit";
import { saveModel } from "@/lib/persistence/models";
import { PRINT_METHOD_LIST } from "@/lib/catalog/printMethod";
import type {
  BaseSize,
  GarmentType,
  GradeRule,
  PrintArea,
  SKU,
  View,
  ViewKind,
} from "@/types";

const inp = "w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm";

const SkuViewCanvas = dynamic(
  () => import("@/components/admin/SkuViewCanvas").then((m) => m.SkuViewCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Загрузка холста…
      </div>
    ),
  },
);

const VIEW_KINDS: { value: ViewKind; label: string }[] = [
  { value: "front", label: "перёд" },
  { value: "back", label: "спина" },
  { value: "sleeve_left", label: "рукав (л)" },
  { value: "sleeve_right", label: "рукав (п)" },
  { value: "label_neck_inner", label: "этикетка (внутр.)" },
  { value: "label_neck_outer", label: "этикетка (внеш.)" },
];

export function SkuEditor({
  initial,
  onBack,
  onSaved,
}: {
  initial: SKU;
  onBack: () => void;
  onSaved: (id: string) => void;
}) {
  const [sku, setSku] = useState<SKU>(initial);
  const [activeViewId, setActiveViewId] = useState(initial.views[0]?.id ?? "");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    initial.views[0]?.print_areas[0]?.id ?? null,
  );
  const [newSize, setNewSize] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const replaceFlat = async (file: File, viewId: string) => {
    const loaded = await loadAsset(file);
    // scale = реальная ширина (мм) / пиксели → флэт сразу в верном масштабе
    // (как в FlatCreator). При оценочном размере калибровка уточнит вручную.
    const scale =
      loaded.naturalWidth > 0
        ? loaded.intrinsic_size_mm.width / loaded.naturalWidth
        : 1;
    setSku((s) =>
      updateView(s, viewId, {
        flat_svg: loaded.dataUrl,
        scale_mm_per_unit: scale,
      }),
    );
  };

  const errors = useMemo(() => validateSku(sku), [sku]);
  const view = sku.views.find((v) => v.id === activeViewId) ?? sku.views[0];

  const save = async () => {
    if (errors.length) return;
    await saveModel(sku);
    setMsg("Сохранено");
    onSaved(sku.id);
  };

  const isSleeve =
    view?.kind === "sleeve_left" || view?.kind === "sleeve_right";
  const isLabel = view?.kind.startsWith("label");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-2.5">
        <button onClick={onBack} className="text-sm text-neutral-400 hover:text-white">
          ← К списку
        </button>
        <span className="text-sm font-semibold">Редактирование SKU</span>
        <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
          {sku.id}
        </span>
        <button
          onClick={save}
          disabled={errors.length > 0}
          className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Сохранить в каталог
        </button>
        {msg && <span className="text-xs text-emerald-400">{msg}</span>}
      </header>

      {errors.length > 0 && (
        <div className="border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-xs text-red-300">
          {errors.slice(0, 6).map((e, i) => (
            <div key={i}>⚠ {e}</div>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Форма-сайдбар */}
        <aside className="w-96 shrink-0 space-y-4 overflow-y-auto border-r border-neutral-800 p-4">
          <Section title="Модель">
            <Field label="Название">
              <input
                value={sku.name}
                onChange={(e) => setSku({ ...sku, name: e.target.value })}
                className={inp}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Тип">
                <select
                  value={sku.type}
                  onChange={(e) =>
                    setSku({ ...sku, type: e.target.value as GarmentType })
                  }
                  className={inp}
                >
                  <option value="tshirt">tshirt</option>
                  <option value="sweatshirt">sweatshirt</option>
                  <option value="hoodie">hoodie</option>
                  <option value="shopper">shopper</option>
                </select>
              </Field>
              <Field label="Базовый размер">
                <select
                  value={sku.base_size}
                  onChange={(e) =>
                    setSku({ ...sku, base_size: e.target.value as BaseSize })
                  }
                  className={inp}
                >
                  {sku.sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Размеры (ростовка)">
              <div className="flex flex-wrap items-center gap-1.5">
                {sku.sizes.map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 text-xs"
                  >
                    {s}
                    {s !== sku.base_size && (
                      <button
                        onClick={() => setSku(removeSize(sku, s))}
                        className="text-neutral-500 hover:text-red-400"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
                <input
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSize.trim()) {
                      setSku(addSize(sku, newSize));
                      setNewSize("");
                    }
                  }}
                  placeholder="+ размер"
                  className="w-20 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs"
                />
              </div>
            </Field>
          </Section>

          <Section title="Виды">
            <div className="flex flex-col gap-1.5">
              {sku.views.map((v) => (
                <div
                  key={v.id}
                  className={`flex items-center justify-between rounded border px-2 py-1.5 text-sm ${
                    v.id === activeViewId
                      ? "border-blue-500 bg-neutral-800"
                      : "border-neutral-700 bg-neutral-900"
                  }`}
                >
                  <button
                    onClick={() => {
                      setActiveViewId(v.id);
                      setSelectedZoneId(v.print_areas[0]?.id ?? null);
                    }}
                    className="flex-1 text-left"
                  >
                    {v.kind}{" "}
                    <span className="text-xs text-neutral-500">
                      · {v.print_areas.length} зон.
                    </span>
                  </button>
                  {sku.views.length > 1 && (
                    <button
                      onClick={() => {
                        const remaining = sku.views.filter((x) => x.id !== v.id);
                        setSku(removeView(sku, v.id));
                        if (activeViewId === v.id && remaining[0]) {
                          setActiveViewId(remaining[0].id);
                          setSelectedZoneId(
                            remaining[0].print_areas[0]?.id ?? null,
                          );
                        }
                      }}
                      className="text-neutral-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <AddViewSelect onAdd={(k) => setSku(addView(sku, k))} />
            </div>
          </Section>

          {/* Активный вид — продолжение формы */}
          {view && (
          <div className="space-y-4">
            <Section title={`Вид: ${view.kind}`}>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Тип вида">
                  <select
                    value={view.kind}
                    onChange={(e) =>
                      setSku(
                        updateView(sku, view.id, {
                          kind: e.target.value as ViewKind,
                        }),
                      )
                    }
                    className={inp}
                  >
                    {VIEW_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="мм / unit (scale)">
                  <input
                    type="number"
                    step="0.001"
                    value={view.scale_mm_per_unit}
                    onChange={(e) =>
                      setSku(
                        updateView(sku, view.id, {
                          scale_mm_per_unit: Number(e.target.value) || 1,
                        }),
                      )
                    }
                    className={inp}
                  />
                </Field>
              </div>

              <label className="flex cursor-pointer items-center justify-center rounded border border-dashed border-neutral-700 px-2 py-1.5 text-xs text-neutral-400 hover:border-blue-500">
                {view.flat_svg ? "Заменить флэт (SVG/PNG)" : "Загрузить флэт (SVG/PNG)"}
                <input
                  type="file"
                  accept=".svg,.png,image/svg+xml,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) replaceFlat(f, view.id);
                    e.target.value = "";
                  }}
                />
              </label>

              {/* Якоря */}
              {!isLabel && (
                <div className="grid grid-cols-2 gap-2">
                  {isSleeve ? (
                    <>
                      <NumField
                        label="низ рукава Y"
                        value={view.anchors.sleeve_bottom_y ?? 0}
                        onChange={(n) =>
                          setSku(
                            updateView(sku, view.id, {
                              anchors: { ...view.anchors, sleeve_bottom_y: n },
                            }),
                          )
                        }
                      />
                      <NumField
                        label="центр рукава X"
                        value={view.anchors.sleeve_center_x ?? 0}
                        onChange={(n) =>
                          setSku(
                            updateView(sku, view.id, {
                              anchors: { ...view.anchors, sleeve_center_x: n },
                            }),
                          )
                        }
                      />
                    </>
                  ) : (
                    <>
                      <NumField
                        label="горловина Y"
                        value={view.anchors.neckline_point?.y ?? 0}
                        onChange={(n) =>
                          setSku(
                            updateView(sku, view.id, {
                              anchors: {
                                ...view.anchors,
                                neckline_point: {
                                  x: view.anchors.neckline_point?.x ?? 0,
                                  y: n,
                                },
                              },
                            }),
                          )
                        }
                      />
                      <NumField
                        label="ось центра X"
                        value={view.anchors.center_axis_x ?? 0}
                        onChange={(n) =>
                          setSku(
                            updateView(sku, view.id, {
                              anchors: { ...view.anchors, center_axis_x: n },
                            }),
                          )
                        }
                      />
                    </>
                  )}
                </div>
              )}
            </Section>

            <Section title="Печатные зоны">
              {view.print_areas.map((a) => (
                <ZoneEditor
                  key={a.id}
                  area={a}
                  canRemove={view.print_areas.length > 1}
                  selected={a.id === selectedZoneId}
                  onSelect={() => setSelectedZoneId(a.id)}
                  onChange={(patch) =>
                    setSku(updateZone(sku, view.id, a.id, patch))
                  }
                  onRemove={() => setSku(removeZone(sku, view.id, a.id))}
                />
              ))}
              <button
                onClick={() => setSku(addZone(sku, view.id))}
                className="mt-1 w-full rounded border border-dashed border-neutral-700 px-2 py-1.5 text-xs text-neutral-400 hover:border-neutral-500"
              >
                + зона
              </button>
            </Section>

            {!isLabel && (
              <Section title="Grade-rule (ΔX/ΔY на шаг размера)">
                <GradeRuleEditor
                  rule={view.grade_rule}
                  isSleeve={!!isSleeve}
                  onChange={(r) => setSku(setGradeRule(sku, view.id, r))}
                />
              </Section>
            )}
          </div>
          )}
        </aside>

        {/* Холст активного вида */}
        <main className="relative min-w-0 flex-1 bg-neutral-950">
          {view && (
            <SkuViewCanvas
              view={view}
              selectedZoneId={selectedZoneId}
              onSelectZone={setSelectedZoneId}
              onChange={(patch) => setSku(updateView(sku, view.id, patch))}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ZoneEditor({
  area,
  canRemove,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  area: PrintArea;
  canRemove: boolean;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<PrintArea>) => void;
  onRemove: () => void;
}) {
  const r = zoneRect(area);
  const setRect = (p: Partial<{ x: number; y: number; w: number; h: number }>) => {
    const nr = { ...r, ...p };
    onChange({ polygon_mm: rectZone(area.id, area.name, nr.x, nr.y, nr.w, nr.h).polygon_mm });
  };
  return (
    <div
      onClick={onSelect}
      className={`rounded border bg-neutral-900 p-2 ${
        selected ? "border-blue-500" : "border-neutral-700"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <input
          value={area.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        />
        {canRemove && (
          <button onClick={onRemove} className="text-neutral-500 hover:text-red-400">
            ✕
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <NumField label="X" value={r.x} onChange={(n) => setRect({ x: n })} />
        <NumField label="Y" value={r.y} onChange={(n) => setRect({ y: n })} />
        <NumField label="Ш" value={r.w} onChange={(n) => setRect({ w: Math.max(1, n) })} />
        <NumField label="В" value={r.h} onChange={(n) => setRect({ h: Math.max(1, n) })} />
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <NumField
          label="safe-inset"
          value={area.safe_inset_mm}
          onChange={(n) => onChange({ safe_inset_mm: Math.max(0, n) })}
        />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-neutral-500">метод по умолч.</span>
          <select
            value={area.default_method ?? ""}
            onChange={(e) =>
              onChange({
                default_method: (e.target.value || undefined) as
                  | PrintArea["default_method"],
              })
            }
            className="rounded border border-neutral-700 bg-neutral-950 px-1.5 py-1 text-xs"
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
    </div>
  );
}

function GradeRuleEditor({
  rule,
  isSleeve,
  onChange,
}: {
  rule: GradeRule | undefined;
  isSleeve: boolean;
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

function AddViewSelect({ onAdd }: { onAdd: (k: ViewKind) => void }) {
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value as ViewKind);
        e.target.value = "";
      }}
      className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm"
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

function NumField({
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
      <span className="text-[10px] text-neutral-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-neutral-700 bg-neutral-950 px-1.5 py-1 text-xs tabular-nums"
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-semibold text-neutral-200">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-400">{label}</span>
      {children}
    </label>
  );
}
