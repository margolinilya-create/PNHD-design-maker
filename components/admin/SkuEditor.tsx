"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { loadAsset } from "@/lib/catalog/loadAsset";
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
  moveView,
  moveZone,
  duplicateView,
  mirrorSleeveView,
} from "@/lib/admin/skuEdit";
import { saveModel, deleteModel } from "@/lib/persistence/models";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Copy,
  FlipHorizontal2,
  X,
  TriangleAlert,
} from "lucide-react";
import type {
  BaseSize,
  GarmentType,
  ProductKind,
  SKU,
  View,
  ViewKind,
} from "@/types";
import { GARMENT_TYPE_LABELS, isAccessoryType } from "@/types";
import {
  stripAccessoryNeckline,
  normalizeAccessorySizes,
} from "@/lib/catalog/mergedCatalog";
import { ZoneEditor } from "./ZoneEditor";
import {
  VIEW_KINDS,
  GradeRuleEditor,
  AddViewSelect,
  NumField,
  Section,
  Field,
} from "./skuEditorSections";

const inp = "w-full rounded border border-line bg-shell px-2 py-1.5 text-sm";
const resetBtn =
  "rounded bg-raised px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-200";

const SkuViewCanvas = dynamic(
  () => import("@/components/admin/SkuViewCanvas").then((m) => m.SkuViewCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-gray-400">
        Загрузка холста…
      </div>
    ),
  },
);

export function SkuEditor({
  initial,
  reservedIds = [],
  lockId = false,
  onBack,
  onSaved,
}: {
  initial: SKU;
  reservedIds?: string[];
  /** Правка базовой (seed) карточки: id зафиксирован, сохранение = override. */
  lockId?: boolean;
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

  const errors = useMemo(() => validateSku(sku), [sku]);
  // При lockId id неизменяем — проверка занятости не нужна (это override).
  const idErr = useMemo(
    () => (lockId ? null : idError(sku.id, reservedIds)),
    [sku.id, reservedIds, lockId],
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

  // Зеркальная копия рукава: mirrorSleeveView зеркалит в мм-пространстве
  // (anchors/полигоны хранятся в мм), а naturalWidth — в ЕДИНИЦАХ вида →
  // ширина флэта в мм = naturalWidth × scale_mm_per_unit.
  const mirrorSleeve = async (viewId: string) => {
    const v = sku.views.find((x) => x.id === viewId);
    if (!v?.flat_svg) return;
    try {
      const width = await new Promise<number>((res, rej) => {
        const img = new window.Image();
        img.onload = () => res(img.naturalWidth || 0);
        img.onerror = () => rej(new Error("не прочитать флэт"));
        img.src = effFlat(v, base, base);
      });
      const widthMm = width * (v.scale_mm_per_unit ?? 1);
      const next = mirrorSleeveView(sku, viewId, widthMm);
      if (next === sku) return;
      const i = next.views.findIndex((x) => x.id === viewId);
      const copy = next.views[i + 1];
      setSku(next);
      if (copy) {
        setActiveViewId(copy.id);
        setSelectedZoneId(copy.print_areas[0]?.id ?? null);
      }
    } catch {
      setMsg("Не удалось прочитать флэт для зеркала");
    }
  };

  const save = async () => {
    if (errors.length || idErr) return;
    // Аксессуары нормализуются перед сохранением: горловины нет + ONE SIZE
    // (самоизлечение легаси-моделей и чистка после смены типа «одежда → шоппер»).
    const toSave = normalizeAccessorySizes(stripAccessoryNeckline(sku));
    await saveModel(toSave);
    // Переименование id: убрать старую запись модели.
    if (sku.id !== initial.id) {
      await deleteModel(initial.id);
    }
    setMsg("Сохранено");
    onSaved(sku.id);
  };

  const isSleeve =
    view?.kind === "sleeve_left" || view?.kind === "sleeve_right";
  const isLabel = view?.kind.startsWith("label");
  // Аксессуар (шоппер): горловины нет — её поля/ручки/дельты скрыты.
  const accessory = isAccessoryType(sku.type);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-2.5">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink"
        >
          <ChevronLeft size={16} strokeWidth={1.75} /> К списку
        </button>
        <span className="text-sm font-semibold">Редактирование SKU</span>
        <label className="flex items-center gap-1 text-xs text-gray-400">
          id:
          <input
            value={sku.id}
            disabled={lockId}
            title={
              lockId
                ? "id базовой карточки зафиксирован — правки сохраняются поверх заводской версии"
                : undefined
            }
            onChange={(e) => setSku({ ...sku, id: e.target.value.trim() })}
            className={`w-44 rounded border bg-shell px-2 py-1 text-xs disabled:opacity-60 ${
              idErr ? "border-red-600 text-red-700" : "border-line text-ink"
            }`}
          />
        </label>
        {lockId && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
            правка базовой — сохранится поверх заводской
          </span>
        )}
        {idErr && <span className="text-xs text-red-600">{idErr}</span>}
        <button
          onClick={save}
          disabled={errors.length > 0 || !!idErr}
          className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Сохранить в каталог
        </button>
        {msg && <span className="text-xs text-emerald-600">{msg}</span>}
      </header>

      {errors.length > 0 && (
        <div className="border-b border-red-900/50 bg-red-50 px-4 py-2 text-xs text-red-700">
          {errors.slice(0, 6).map((e, i) => (
            <div key={i} className="flex items-center gap-1">
              <TriangleAlert size={13} strokeWidth={1.75} /> {e}
            </div>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Форма-сайдбар */}
        <aside className="w-96 shrink-0 space-y-4 overflow-y-auto border-r border-line p-4">
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
                  {Object.entries(GARMENT_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
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
            <Field label="Тип продукта">
              <select
                value={sku.product_kind ?? "finished"}
                onChange={(e) =>
                  setSku({
                    ...sku,
                    product_kind: e.target.value as ProductKind,
                  })
                }
                className={inp}
              >
                <option value="finished">на готовом изделии</option>
                <option value="cut">в крое</option>
              </select>
            </Field>
            <Field label="Размеры (ростовка)">
              <div className="flex flex-wrap items-center gap-1.5">
                {sku.sizes.map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1 rounded bg-raised px-2 py-1 text-xs"
                  >
                    {s}
                    {s !== sku.base_size && (
                      <button
                        onClick={() => setSku(removeSize(sku, s))}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <X size={14} strokeWidth={1.75} />
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
                  className="w-20 rounded border border-line bg-shell px-2 py-1 text-xs"
                />
              </div>
            </Field>
          </Section>

          <Section title="Виды">
            <div className="flex flex-col gap-1.5">
              {sku.views.map((v, vi) => (
                <div
                  key={v.id}
                  className={`flex items-center justify-between gap-1 rounded border px-2 py-1.5 text-sm ${
                    v.id === activeViewId
                      ? "border-blue-500 bg-raised"
                      : "border-line bg-white"
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
                    <span className="text-xs text-gray-400">
                      · {v.print_areas.length} зон.
                    </span>
                    {!v.flat_svg && (
                      <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700">
                        <TriangleAlert size={10} strokeWidth={2} /> нет флэта
                      </span>
                    )}
                  </button>
                  {/* Порядок видов = порядок вкладок редактора и страниц PDF. */}
                  <button
                    onClick={() => setSku(moveView(sku, v.id, -1))}
                    disabled={vi === 0}
                    title="Выше"
                    className="text-gray-400 hover:text-ink disabled:opacity-30"
                  >
                    <ChevronUp size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => setSku(moveView(sku, v.id, 1))}
                    disabled={vi === sku.views.length - 1}
                    title="Ниже"
                    className="text-gray-400 hover:text-ink disabled:opacity-30"
                  >
                    <ChevronDown size={14} strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => {
                      const next = duplicateView(sku, v.id);
                      const copy = next.views[vi + 1];
                      setSku(next);
                      if (copy) {
                        setActiveViewId(copy.id);
                        setSelectedZoneId(copy.print_areas[0]?.id ?? null);
                      }
                    }}
                    title="Дублировать вид (с зонами и якорями)"
                    className="text-gray-400 hover:text-ink"
                  >
                    <Copy size={14} strokeWidth={1.75} />
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
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X size={14} strokeWidth={1.75} />
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
                          : "bg-raised text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {sz}
                      {sz === base ? " (база)" : ""}
                      {overridden && (
                        <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-600 align-middle" />
                      )}
                    </button>
                  );
                })}
              </div>
              {perSize &&
                (view.size_flats?.[editSize] ||
                  view.size_anchors?.[editSize] ||
                  view.size_print_areas?.[editSize]) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-gray-400">Сбросить:</span>
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
                <p className="flex items-start gap-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                  <TriangleAlert size={13} strokeWidth={1.75} className="mt-px shrink-0" />
                  <span>
                    На размере {editSize} заданы явные якоря — они имеют приоритет
                    над grade-rule (правило для этого размера не применится).
                  </span>
                </p>
              )}
              <p className="text-[11px] text-gray-400">
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

              <label className="flex cursor-pointer items-center justify-center rounded border border-dashed border-line px-2 py-1.5 text-xs text-gray-500 hover:border-blue-500">
                {(effView.flat_svg ? "Заменить флэт" : "Загрузить флэт") +
                  (perSize ? ` (${editSize})` : "") +
                  " · SVG/PNG"}
                <input
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg,.pdf,.ai,image/svg+xml,image/png,image/jpeg,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) replaceFlat(f, view.id);
                    e.target.value = "";
                  }}
                />
              </label>

              {isSleeve && (
                <button
                  onClick={() => mirrorSleeve(view.id)}
                  disabled={!view.flat_svg}
                  title={
                    view.flat_svg
                      ? "Создать противоположный рукав: геометрия отражается по оси флэта"
                      : "Нужен флэт вида"
                  }
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-line bg-white px-2 py-1.5 text-xs text-ink hover:border-blue-500 disabled:opacity-50"
                >
                  <FlipHorizontal2 size={14} strokeWidth={1.75} />
                  Зеркальная копия L↔R
                </button>
              )}

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
                      {!accessory && (
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
                      )}
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
              {/* Именованные вертикальные оси (выточки/рельефы/швы):
                  пресет «Центр: {имя}» и прилипание в редакторе. */}
              {!isLabel && (
                <div className="mt-2 space-y-1.5">
                  <div className="text-[11px] font-medium text-gray-500">
                    Доп. оси центровки (выточки)
                  </div>
                  {(effView.anchors.axes ?? []).map((ax, i) => (
                    <div key={ax.id} className="flex items-center gap-1.5">
                      <input
                        value={ax.name}
                        onChange={(e) =>
                          setSku(
                            setSizeAnchors(sku, view.id, editSize, base, {
                              ...effView.anchors,
                              axes: (effView.anchors.axes ?? []).map((a, j) =>
                                j === i ? { ...a, name: e.target.value } : a,
                              ),
                            }),
                          )
                        }
                        placeholder="имя (напр. выточка Л)"
                        className={`${inp} flex-1`}
                      />
                      <input
                        type="number"
                        value={ax.x}
                        onChange={(e) =>
                          setSku(
                            setSizeAnchors(sku, view.id, editSize, base, {
                              ...effView.anchors,
                              axes: (effView.anchors.axes ?? []).map((a, j) =>
                                j === i
                                  ? { ...a, x: Number(e.target.value) }
                                  : a,
                              ),
                            }),
                          )
                        }
                        title="X оси, мм"
                        className={`${inp} w-24`}
                      />
                      <button
                        onClick={() =>
                          setSku(
                            setSizeAnchors(sku, view.id, editSize, base, {
                              ...effView.anchors,
                              axes: (effView.anchors.axes ?? []).filter(
                                (_, j) => j !== i,
                              ),
                            }),
                          )
                        }
                        title="Удалить ось"
                        className="shrink-0 rounded px-1.5 py-1 text-gray-400 hover:text-red-600"
                      >
                        <X size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setSku(
                        setSizeAnchors(sku, view.id, editSize, base, {
                          ...effView.anchors,
                          axes: [
                            ...(effView.anchors.axes ?? []),
                            {
                              id: `axis-${Date.now().toString(36)}`,
                              name: `ось ${(effView.anchors.axes?.length ?? 0) + 1}`,
                              x: Math.round(
                                effView.anchors.center_axis_x ?? 0,
                              ),
                            },
                          ],
                        }),
                      )
                    }
                    className="w-full rounded border border-dashed border-line px-2 py-1.5 text-xs text-gray-500 hover:border-gray-400"
                  >
                    + ось
                  </button>
                </div>
              )}
            </Section>

            <Section title="Печатные зоны">
              {effView.print_areas.map((a, ai) => (
                <ZoneEditor
                  key={a.id}
                  area={a}
                  perSize={perSize}
                  canRemove={!perSize && effView.print_areas.length > 1}
                  canMoveUp={ai > 0}
                  canMoveDown={ai < effView.print_areas.length - 1}
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
                  onMove={(dir) => setSku(moveZone(sku, view.id, a.id, dir))}
                />
              ))}
              {!perSize && (
                <button
                  onClick={() => setSku(addZone(sku, view.id))}
                  className="mt-1 w-full rounded border border-dashed border-line px-2 py-1.5 text-xs text-gray-500 hover:border-gray-400"
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
                  accessory={accessory}
                  onChange={(r) => setSku(setGradeRule(sku, view.id, r))}
                />
                <p className="text-[11px] text-gray-400">
                  Правило раскладывает якоря по ростовке от базового размера. Если
                  на размере заданы явные якоря (вкладка размера) — они перекрывают
                  правило для этого размера.
                </p>
              </Section>
            )}

          </div>
          )}
        </aside>

        {/* Холст активного вида */}
        <main className="relative min-w-0 flex-1 bg-shell">
          {effView && (
            <SkuViewCanvas
              key={`${effView.id}-${editSize}`}
              view={effView}
              selectedZoneId={selectedZoneId}
              accessory={accessory}
              onSelectZone={setSelectedZoneId}
              onChange={onCanvasChange}
            />
          )}
        </main>
      </div>
    </div>
  );
}
