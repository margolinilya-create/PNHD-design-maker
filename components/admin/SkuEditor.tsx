"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { loadAsset } from "@/lib/catalog/loadAsset";
import { generateMaskFromPhoto } from "@/lib/admin/autoMask";
import {
  validateSku,
  idError,
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
  effAnchors,
  effZones,
  effFlat,
  setSizeAnchors,
  setSizeZones,
  setSizeFlat,
  updateSizeZoneRect,
  clearSizeOverride,
  clearSizeAnchors,
  clearSizeZones,
  clearSizeFlat,
} from "@/lib/admin/skuEdit";
import { saveModel, deleteModel } from "@/lib/persistence/models";
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
const resetBtn =
  "rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-400 hover:bg-neutral-700";

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
  reservedIds = [],
  onBack,
  onSaved,
}: {
  initial: SKU;
  reservedIds?: string[];
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
  // Размер, под который правим геометрию (per-size override; базовый = общий).
  const [editSize, setEditSize] = useState<string>(initial.base_size);
  // Авто-маска ткани для фото-мокапа.
  const [maskThreshold, setMaskThreshold] = useState(150);
  const [maskInvert, setMaskInvert] = useState(false);
  const [maskBusy, setMaskBusy] = useState(false);

  // editSize всегда должен быть среди размеров (напр. после удаления размера).
  useEffect(() => {
    if (!sku.sizes.includes(editSize) && sku.sizes.length) {
      setEditSize(sku.base_size);
    }
  }, [sku.sizes, sku.base_size, editSize]);

  const replaceFlat = async (file: File, viewId: string) => {
    const loaded = await loadAsset(file);
    // scale = реальная ширина (мм) / пиксели → флэт сразу в верном масштабе.
    const scale =
      loaded.naturalWidth > 0
        ? loaded.intrinsic_size_mm.width / loaded.naturalWidth
        : 1;
    setSku((s) => {
      // Флэт — per-size; масштаб (scale) — общий на вид.
      const withScale = updateView(s, viewId, { scale_mm_per_unit: scale });
      return setSizeFlat(withScale, viewId, editSize, s.base_size, loaded.dataUrl);
    });
  };

  // Фото-мокап (превью для клиента) — на уровне вида, не per-size.
  type Mockup = NonNullable<View["mockup"]>;
  const addMockup = async (file: File) => {
    if (!view) return;
    const loaded = await loadAsset(file);
    setSku(
      updateView(sku, view.id, {
        mockup: {
          photo: loaded.dataUrl,
          print: view.mockup?.print ?? { x: 0.3, y: 0.22, w: 0.4 },
          mask: view.mockup?.mask,
        },
      }),
    );
  };
  const patchMockup = (patch: Partial<Mockup>) => {
    if (!view?.mockup) return;
    setSku(updateView(sku, view.id, { mockup: { ...view.mockup, ...patch } }));
  };
  const autoMask = async () => {
    if (!view?.mockup) return;
    setMaskBusy(true);
    try {
      const mask = await generateMaskFromPhoto(
        view.mockup.photo,
        maskThreshold,
        maskInvert,
      );
      patchMockup({ mask });
    } finally {
      setMaskBusy(false);
    }
  };

  const errors = useMemo(() => validateSku(sku), [sku]);
  const idErr = useMemo(
    () => idError(sku.id, reservedIds),
    [sku.id, reservedIds],
  );
  const view = sku.views.find((v) => v.id === activeViewId) ?? sku.views[0];
  const base = sku.base_size;
  const perSize = editSize !== base;

  // Эффективный вид для выбранного размера (override → фоллбэк на базовые).
  const effView: View | null = view
    ? {
        ...view,
        flat_svg: effFlat(view, editSize, base),
        anchors: effAnchors(view, editSize, base),
        print_areas: effZones(view, editSize, base),
      }
    : null;

  // Правки с холста → роутинг по размеру.
  const onCanvasChange = (patch: Partial<View>) => {
    if (!view) return;
    if (patch.anchors) {
      setSku(setSizeAnchors(sku, view.id, editSize, base, patch.anchors));
    } else if (patch.print_areas) {
      setSku(setSizeZones(sku, view.id, editSize, base, patch.print_areas));
    } else if (patch.scale_mm_per_unit !== undefined) {
      setSku(updateView(sku, view.id, { scale_mm_per_unit: patch.scale_mm_per_unit }));
    } else {
      setSku(updateView(sku, view.id, patch));
    }
  };

  const save = async () => {
    if (errors.length || idErr) return;
    await saveModel(sku);
    // Переименование id: убрать старую запись модели, чтобы не плодить дубли.
    if (sku.id !== initial.id) await deleteModel(initial.id);
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
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          id:
          <input
            value={sku.id}
            onChange={(e) => setSku({ ...sku, id: e.target.value.trim() })}
            className={`w-44 rounded border bg-neutral-950 px-2 py-1 text-xs ${
              idErr ? "border-red-600 text-red-300" : "border-neutral-700 text-neutral-200"
            }`}
          />
        </label>
        {idErr && <span className="text-xs text-red-400">{idErr}</span>}
        <button
          onClick={save}
          disabled={errors.length > 0 || !!idErr}
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
          {view && effView && (
          <div className="space-y-4">
            <Section title="Размер геометрии">
              <div className="flex flex-wrap gap-1.5">
                {sku.sizes.map((sz) => {
                  const overridden =
                    sz !== base &&
                    !!(
                      view.size_anchors?.[sz] ||
                      view.size_print_areas?.[sz] ||
                      view.size_flats?.[sz]
                    );
                  return (
                    <button
                      key={sz}
                      onClick={() => setEditSize(sz)}
                      className={`rounded px-2.5 py-1 text-xs ${
                        sz === editSize
                          ? "bg-blue-600 text-white"
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      {sz}
                      {sz === base ? " (база)" : overridden ? " ●" : ""}
                    </button>
                  );
                })}
              </div>
              {perSize &&
                (view.size_flats?.[editSize] ||
                  view.size_anchors?.[editSize] ||
                  view.size_print_areas?.[editSize]) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-neutral-500">Сбросить:</span>
                    {view.size_flats?.[editSize] && (
                      <button
                        onClick={() => setSku(clearSizeFlat(sku, view.id, editSize))}
                        className={resetBtn}
                      >
                        флэт
                      </button>
                    )}
                    {view.size_anchors?.[editSize] && (
                      <button
                        onClick={() => setSku(clearSizeAnchors(sku, view.id, editSize))}
                        className={resetBtn}
                      >
                        якоря
                      </button>
                    )}
                    {view.size_print_areas?.[editSize] && (
                      <button
                        onClick={() => setSku(clearSizeZones(sku, view.id, editSize))}
                        className={resetBtn}
                      >
                        зоны
                      </button>
                    )}
                    <button
                      onClick={() => setSku(clearSizeOverride(sku, view.id, editSize))}
                      className={resetBtn}
                    >
                      всё
                    </button>
                  </div>
                )}
              {perSize && view.grade_rule && view.size_anchors?.[editSize] && (
                <p className="rounded bg-amber-950/40 px-2 py-1 text-[11px] text-amber-300">
                  ⚠ На размере {editSize} заданы явные якоря — они имеют приоритет
                  над grade-rule (правило для этого размера не применится).
                </p>
              )}
              <p className="text-[11px] text-neutral-500">
                {perSize
                  ? `Правка флэта, якорей и прямоугольников зон — только для ${editSize}. Состав зон, метод, размеры и grade-rule — общие.`
                  : "Базовый размер: правки идут в основную геометрию вида."}
              </p>
            </Section>

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
                {(effView.flat_svg ? "Заменить флэт" : "Загрузить флэт") +
                  (perSize ? ` (${editSize})` : "") +
                  " · SVG/PNG"}
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

              {/* Якоря (per-size: пишем под выбранный размер) */}
              {!isLabel && (
                <div className="grid grid-cols-2 gap-2">
                  {isSleeve ? (
                    <>
                      <NumField
                        label="низ рукава Y"
                        value={effView.anchors.sleeve_bottom_y ?? 0}
                        onChange={(n) =>
                          setSku(
                            setSizeAnchors(sku, view.id, editSize, base, {
                              ...effView.anchors,
                              sleeve_bottom_y: n,
                            }),
                          )
                        }
                      />
                      <NumField
                        label="центр рукава X"
                        value={effView.anchors.sleeve_center_x ?? 0}
                        onChange={(n) =>
                          setSku(
                            setSizeAnchors(sku, view.id, editSize, base, {
                              ...effView.anchors,
                              sleeve_center_x: n,
                            }),
                          )
                        }
                      />
                    </>
                  ) : (
                    <>
                      <NumField
                        label="горловина Y"
                        value={effView.anchors.neckline_point?.y ?? 0}
                        onChange={(n) =>
                          setSku(
                            setSizeAnchors(sku, view.id, editSize, base, {
                              ...effView.anchors,
                              neckline_point: {
                                x: effView.anchors.neckline_point?.x ?? 0,
                                y: n,
                              },
                            }),
                          )
                        }
                      />
                      <NumField
                        label="ось центра X"
                        value={effView.anchors.center_axis_x ?? 0}
                        onChange={(n) =>
                          setSku(
                            setSizeAnchors(sku, view.id, editSize, base, {
                              ...effView.anchors,
                              center_axis_x: n,
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
              {effView.print_areas.map((a) => (
                <ZoneEditor
                  key={a.id}
                  area={a}
                  perSize={perSize}
                  canRemove={!perSize && effView.print_areas.length > 1}
                  selected={a.id === selectedZoneId}
                  onSelect={() => setSelectedZoneId(a.id)}
                  onRect={(rect) =>
                    setSku(
                      updateSizeZoneRect(sku, view.id, editSize, base, a.id, rect),
                    )
                  }
                  onMeta={(patch) =>
                    setSku(updateZone(sku, view.id, a.id, patch))
                  }
                  onRemove={() => setSku(removeZone(sku, view.id, a.id))}
                />
              ))}
              {!perSize && (
                <button
                  onClick={() => setSku(addZone(sku, view.id))}
                  className="mt-1 w-full rounded border border-dashed border-neutral-700 px-2 py-1.5 text-xs text-neutral-400 hover:border-neutral-500"
                >
                  + зона
                </button>
              )}
            </Section>

            {!isLabel && (
              <Section title="Grade-rule (ΔX/ΔY на шаг размера)">
                <GradeRuleEditor
                  rule={view.grade_rule}
                  isSleeve={!!isSleeve}
                  onChange={(r) => setSku(setGradeRule(sku, view.id, r))}
                />
                <p className="text-[11px] text-neutral-500">
                  Правило раскладывает якоря по ростовке от базового размера. Если
                  на размере заданы явные якоря (вкладка размера) — они перекрывают
                  правило для этого размера.
                </p>
              </Section>
            )}

            <Section title="Фото-мокап (превью для клиента)">
              {!view.mockup ? (
                <label className="flex cursor-pointer items-center justify-center rounded border border-dashed border-neutral-700 px-2 py-1.5 text-xs text-neutral-400 hover:border-blue-500">
                  Добавить фото изделия (для превью клиенту)
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) addMockup(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={view.mockup.photo}
                      alt="мокап"
                      className="h-16 w-16 rounded object-cover"
                    />
                    {view.mockup.mask && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={view.mockup.mask}
                        alt="маска"
                        className="h-16 w-16 rounded bg-neutral-800 object-contain"
                        title="маска ткани"
                      />
                    )}
                    <div className="flex flex-col gap-1">
                      <label className="cursor-pointer rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700">
                        Заменить фото
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) addMockup(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        onClick={() =>
                          setSku(updateView(sku, view.id, { mockup: undefined }))
                        }
                        className="rounded bg-neutral-800 px-2 py-1 text-[11px] text-neutral-400 hover:bg-neutral-700"
                      >
                        Убрать мокап
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <NumField
                      label="зона X (0..1)"
                      value={view.mockup.print.x}
                      onChange={(n) =>
                        patchMockup({ print: { ...view.mockup!.print, x: n } })
                      }
                    />
                    <NumField
                      label="зона Y (0..1)"
                      value={view.mockup.print.y}
                      onChange={(n) =>
                        patchMockup({ print: { ...view.mockup!.print, y: n } })
                      }
                    />
                    <NumField
                      label="зона Ш (0..1)"
                      value={view.mockup.print.w}
                      onChange={(n) =>
                        patchMockup({ print: { ...view.mockup!.print, w: n } })
                      }
                    />
                  </div>

                  {/* Маска ткани для перекраски под цвет */}
                  <div className="rounded border border-neutral-800 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] text-neutral-400">
                        Маска ткани {view.mockup.mask ? "✓" : "— нет"}
                      </span>
                      {view.mockup.mask && (
                        <button
                          onClick={() => patchMockup({ mask: undefined })}
                          className="text-[11px] text-neutral-500 hover:text-red-400"
                        >
                          убрать
                        </button>
                      )}
                    </div>
                    <p className="mb-1.5 text-[10px] text-neutral-500">
                      Нужна для перекраски фото под цвет изделия (multiply по ткани).
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-neutral-500">
                        порог {maskThreshold}
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={255}
                        value={maskThreshold}
                        onChange={(e) => setMaskThreshold(Number(e.target.value))}
                        className="flex-1"
                      />
                      <label className="flex items-center gap-1 text-[10px] text-neutral-500">
                        <input
                          type="checkbox"
                          checked={maskInvert}
                          onChange={(e) => setMaskInvert(e.target.checked)}
                        />
                        инверт.
                      </label>
                    </div>
                    <div className="mt-1.5 flex gap-2">
                      <button
                        onClick={autoMask}
                        disabled={maskBusy}
                        className="flex-1 rounded bg-neutral-700 px-2 py-1 text-[11px] text-neutral-100 hover:bg-neutral-600 disabled:opacity-50"
                      >
                        {maskBusy ? "…" : "Авто-маска по яркости"}
                      </button>
                      <label className="flex-1 cursor-pointer rounded bg-neutral-800 px-2 py-1 text-center text-[11px] text-neutral-300 hover:bg-neutral-700">
                        Загрузить маску
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) patchMockup({ mask: (await loadAsset(f)).dataUrl });
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}
            </Section>
          </div>
          )}
        </aside>

        {/* Холст активного вида */}
        <main className="relative min-w-0 flex-1 bg-neutral-950">
          {effView && (
            <SkuViewCanvas
              key={`${effView.id}-${editSize}`}
              view={effView}
              selectedZoneId={selectedZoneId}
              onSelectZone={setSelectedZoneId}
              onChange={onCanvasChange}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ZoneEditor({
  area,
  perSize,
  canRemove,
  selected,
  onSelect,
  onRect,
  onMeta,
  onRemove,
}: {
  area: PrintArea;
  perSize: boolean;
  canRemove: boolean;
  selected: boolean;
  onSelect: () => void;
  onRect: (rect: { x: number; y: number; w: number; h: number }) => void;
  onMeta: (patch: Partial<PrintArea>) => void;
  onRemove: () => void;
}) {
  const r = zoneRect(area);
  const setRect = (p: Partial<{ x: number; y: number; w: number; h: number }>) =>
    onRect({ ...r, ...p });
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
          onChange={(e) => onMeta({ name: e.target.value })}
          disabled={perSize}
          className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm disabled:opacity-60"
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
      {!perSize && (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <NumField
            label="safe-inset"
            value={area.safe_inset_mm}
            onChange={(n) => onMeta({ safe_inset_mm: Math.max(0, n) })}
          />
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-neutral-500">метод по умолч.</span>
            <select
              value={area.default_method ?? ""}
              onChange={(e) =>
                onMeta({
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
      )}
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
