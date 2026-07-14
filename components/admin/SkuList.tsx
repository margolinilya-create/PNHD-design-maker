"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadMergedCatalog,
  overrideDiffersFromSeed,
} from "@/lib/catalog/mergedCatalog";
import { deleteModel, saveModel } from "@/lib/persistence/models";
import {
  pushRevision,
  deleteRevisions,
} from "@/lib/persistence/modelRevisions";
import { cloneSku } from "@/lib/admin/skuEdit";
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import type { GarmentType, ProductCategory, SKU } from "@/types";
import {
  GARMENT_TYPE_LABELS,
  PRODUCT_CATEGORY_LABELS,
  skuCategory,
} from "@/types";

interface Entry {
  sku: SKU;
  source: "seed" | "model";
  /** Seed-карточка перекрыта сохранённой правкой (override). */
  overridden: boolean;
  /** Правки затрагивают не только флаг hidden (для бейджа «изменена»). */
  changed: boolean;
  /** Сырая строка модели (для редактора — без развёрнутых grade_rule). */
  raw?: SKU;
}

export function SkuList({
  onEdit,
  onCreate,
}: {
  onEdit: (sku: SKU, reservedIds: string[], lockId?: boolean) => void;
  onCreate: () => void;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Гвард от setState после размонтирования / out-of-order резолюции.
  const load = useCallback(async (isAlive: () => boolean = () => true) => {
    try {
      const merged = await loadMergedCatalog();
      if (!isAlive()) return;
      setEntries(
        merged.skus.map((s) => {
          const overridden = merged.overriddenIds.has(s.id);
          const seedOrig = merged.seedById.get(s.id);
          const raw = merged.rawModels.get(s.id);
          return {
            sku: s,
            source: merged.seedIds.has(s.id) ? "seed" : "model",
            overridden,
            // «изменена» — если правки не сводятся к скрытию.
            changed:
              overridden && !!seedOrig && !!raw
                ? overrideDiffersFromSeed(seedOrig, raw)
                : false,
            raw,
          };
        }),
      );
    } catch (e) {
      if (isAlive()) setErr(String(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load(() => alive);
    return () => {
      alive = false;
    };
  }, [load]);

  // Фильтр по группе товаров (как на главной) — работает вместе с поиском.
  const [typeFilter, setTypeFilter] = useState<GarmentType | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (entries ?? []).filter(
      (e) =>
        (!typeFilter || e.sku.type === typeFilter) &&
        (!t ||
          e.sku.name.toLowerCase().includes(t) ||
          e.sku.id.toLowerCase().includes(t)),
    );
  }, [entries, q, typeFilter]);

  const typeCounts = useMemo(() => {
    const m = new Map<GarmentType, number>();
    for (const e of entries ?? []) m.set(e.sku.type, (m.get(e.sku.type) ?? 0) + 1);
    return m;
  }, [entries]);
  const types = (Object.keys(GARMENT_TYPE_LABELS) as GarmentType[]).filter((t) =>
    typeCounts.has(t),
  );
  const activeType = typeFilter && typeCounts.has(typeFilter) ? typeFilter : null;

  const chip = (on: boolean) =>
    `rounded-md px-2.5 py-1 text-xs transition ${
      on
        ? "bg-blue-600 font-medium text-white"
        : "border border-line bg-white text-gray-700 hover:border-blue-500"
    }`;

  // Скрыть/показать в клиентском каталоге. Для базовой карточки скрытие
  // сохраняется как override (только с флагом hidden).
  const toggleHidden = async (entry: Entry) => {
    const src = entry.raw ?? entry.sku;
    await saveModel({ ...src, hidden: !src.hidden });
    await load();
  };

  const reservedFor = (id: string) =>
    (entries ?? []).filter((e) => e.sku.id !== id).map((e) => e.sku.id);

  const duplicate = async (sku: SKU) => {
    const newId = `${sku.id}-copy-${Date.now().toString(36).slice(-4)}`;
    const copy = cloneSku(sku, newId, `${sku.name} (копия)`);
    await saveModel(copy);
    const reserved = (entries ?? []).map((e) => e.sku.id);
    await load();
    onEdit(copy, reserved);
  };

  const onDelete = async (id: string) => {
    await deleteModel(id);
    await deleteRevisions(id).catch(() => {});
    await load();
  };

  // Сброс override seed-карточки: удаляем сохранённую правку — merge вернёт
  // заводскую версию из /seed/skus.json.
  const resetToSeed = async (sku: SKU) => {
    if (
      !window.confirm(
        `Вернуть заводскую версию «${sku.name}»? Сохранённые правки карточки будут удалены.`,
      )
    )
      return;
    // Сброс обратим: текущий override — в историю перед удалением.
    const src = entries?.find((e) => e.sku.id === sku.id)?.raw;
    if (src) await pushRevision(sku.id, src).catch(() => {});
    await deleteModel(sku.id);
    await load();
  };

  if (err) return <p className="p-4 text-red-700">Ошибка: {err}</p>;
  if (!entries) return <p className="p-4 text-gray-500">Загрузка каталога…</p>;

  // Секции «Одежда / Аксессуары»: поиск и чипы типов работают сквозь обе.
  // Заголовки показываем, только когда непустых секций больше одной.
  const groups = (Object.keys(PRODUCT_CATEGORY_LABELS) as ProductCategory[])
    .map((c) => ({
      category: c,
      items: filtered.filter((e) => skuCategory(e.sku) === c),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию / id…"
          className="w-64 rounded border border-line bg-white px-3 py-1.5 text-sm text-gray-900"
        />
        <button
          onClick={onCreate}
          className="ml-auto inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={14} strokeWidth={1.75} /> Создать из флэта / DXF
        </button>
      </div>

      {types.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button onClick={() => setTypeFilter(null)} className={chip(activeType === null)}>
            Все <span className="opacity-60">{entries.length}</span>
          </button>
          {types.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={chip(activeType === t)}>
              {GARMENT_TYPE_LABELS[t]}{" "}
              <span className="opacity-60">{typeCounts.get(t)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.map(({ category, items }) => (
          <section key={category} className="mb-6">
            {groups.length > 1 && (
              <h3 className="mb-2 text-sm font-semibold text-gray-500">
                {PRODUCT_CATEGORY_LABELS[category]}{" "}
                <span className="font-normal opacity-70">{items.length}</span>
              </h3>
            )}
            <div className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ sku, source, overridden, changed, raw }) => {
          const preview =
            sku.views.find((v) => v.kind === "front")?.flat_svg ||
            sku.views[0]?.flat_svg;
          return (
          <div
            key={`${source}-${sku.id}`}
            className={`rounded-xl border border-line bg-white p-4 shadow-sm ${
              sku.hidden ? "opacity-60" : ""
            }`}
          >
            <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded bg-shell">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[11px] text-gray-400">нет флэта</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{sku.name}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  source === "seed"
                    ? "bg-raised text-gray-500"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {source === "seed" ? "база" : "моя"}
              </span>
              {changed && (
                <span
                  className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700"
                  title="Заводская карточка перекрыта сохранёнными правками"
                >
                  изменена
                </span>
              )}
              {sku.hidden && (
                <span
                  className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500"
                  title="Скрыта из клиентского каталога"
                >
                  скрыта
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-gray-400">{sku.id}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {sku.views.map((v) => (
                <span
                  key={v.id}
                  className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-gray-700"
                >
                  {v.kind}
                </span>
              ))}
            </div>
            <div className="mt-1 text-[11px] text-gray-400">
              Размеры: {sku.sizes.join(", ")}
            </div>

            <div className="mt-3 flex items-center gap-2">
              {/* Редактируются ВСЕ карточки. База правится на месте:
                  сохранение под тем же id перекрывает заводскую версию. */}
              <button
                onClick={() =>
                  onEdit(raw ?? sku, reservedFor(sku.id), source === "seed")
                }
                title={
                  source === "seed"
                    ? "Правки сохранятся поверх заводской карточки (без копии)"
                    : undefined
                }
                className="inline-flex items-center gap-1 rounded bg-raised px-2.5 py-1 text-xs text-ink hover:bg-gray-200"
              >
                <Pencil size={14} strokeWidth={1.75} /> Редактировать
              </button>
              <button
                // Клонируем СЫРУЮ строку (raw), не развёрнутую из merge —
                // иначе явные size_anchors «запекутся» и grade_rule копии
                // станет инертным (см. mergedCatalog.rawModels).
                onClick={() => duplicate(raw ?? sku)}
                className="inline-flex items-center gap-1 rounded bg-raised px-2.5 py-1 text-xs text-gray-700 hover:bg-line-soft"
              >
                <Copy size={14} strokeWidth={1.75} /> Дублировать
              </button>
              {overridden && (
                <button
                  onClick={() => resetToSeed(sku)}
                  title="Удалить правки и вернуть заводскую версию"
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-amber-700 hover:bg-amber-50"
                >
                  <RotateCcw size={14} strokeWidth={1.75} /> Сбросить
                </button>
              )}
              <button
                onClick={() => toggleHidden({ sku, source, overridden, changed, raw })}
                title={
                  sku.hidden
                    ? "Показать в клиентском каталоге"
                    : "Скрыть из клиентского каталога"
                }
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-gray-100 ${
                  source === "model" ? "" : "ml-auto"
                } text-gray-500`}
              >
                {sku.hidden ? (
                  <EyeOff size={14} strokeWidth={1.75} />
                ) : (
                  <Eye size={14} strokeWidth={1.75} />
                )}
              </button>
              {source === "model" && (
                <button
                  onClick={() => onDelete(sku.id)}
                  className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:text-red-600"
                >
                  <Trash2 size={14} strokeWidth={1.75} /> Удалить
                </button>
              )}
            </div>
          </div>
              );
              })}
            </div>
          </section>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400">Ничего не найдено.</p>
        )}
      </div>
    </div>
  );
}
