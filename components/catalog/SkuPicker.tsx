"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, HardDrive, X } from "lucide-react";
import { loadMergedCatalog } from "@/lib/catalog/mergedCatalog";
import { deleteModel } from "@/lib/persistence/models";
import { isCloud } from "@/lib/persistence/projects";
import { useProjectStore } from "@/lib/state/projectStore";
import type { GarmentType, ProductCategory, ProductKind } from "@/types";
import {
  GARMENT_TYPE_LABELS,
  PRODUCT_CATEGORY_LABELS,
  skuCategory,
  ONE_SIZE,
} from "@/types";

export function SkuPicker({ kind = "finished" }: { kind?: ProductKind }) {
  const router = useRouter();
  const catalog = useProjectStore((s) => s.catalog);
  const setCatalog = useProjectStore((s) => s.setCatalog);
  const selectSku = useProjectStore((s) => s.selectSku);
  const [error, setError] = useState<string | null>(null);
  // id моделей, добавленных пользователем (можно удалить).
  const [customIds, setCustomIds] = useState<Set<string>>(new Set());
  // Раздел каталога: одежда / аксессуары (шопперы).
  const [category, setCategory] = useState<ProductCategory>("clothing");
  // Фильтр по группе товаров (null = все группы).
  const [typeFilter, setTypeFilter] = useState<GarmentType | null>(null);

  const load = useCallback(
    async (isAlive: () => boolean = () => true) => {
      try {
        // Merge seed + модели (override по id) — единая логика с админкой.
        const merged = await loadMergedCatalog();
        if (!isAlive()) return;
        // «X» (удаление с главной) — только у собственных моделей; override
        // seed-карточек сбрасывается в админке кнопкой «Сбросить к заводской».
        setCustomIds(merged.customIds);
        setCatalog({ skus: merged.skus });
      } catch (e) {
        if (isAlive()) setError(String(e));
      }
    },
    [setCatalog],
  );

  // SWR: грузим на каждый заход (правки из админки должны подтянуться при
  // SPA-навигации), кэш из стора рендерится, пока идёт загрузка. alive-гвард
  // отсекает setState после размонтирования / устаревшую загрузку.
  useEffect(() => {
    let alive = true;
    load(() => alive);
    return () => {
      alive = false;
    };
  }, [load]);

  const open = (skuId: string) => {
    selectSku(skuId);
    router.push("/editor");
  };

  const onDelete = async (id: string) => {
    await deleteModel(id);
    setCatalog({ skus: catalog!.skus.filter((s) => s.id !== id) });
    setCustomIds((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };

  if (error)
    return <p className="text-red-600">Ошибка загрузки каталога: {error}</p>;
  if (!catalog)
    return <p className="text-gray-500">Загрузка каталога…</p>;

  // Первичное разделение каталога: готовое изделие / крой; скрытые — только в админке.
  const skus = catalog.skus.filter(
    (sku) => !sku.hidden && (sku.product_kind ?? "finished") === kind,
  );
  if (!skus.length)
    return (
      <p className="text-gray-500">
        {kind === "cut"
          ? "Раздел «В крое» пока пуст — появится в следующей итерации."
          : "В каталоге пока нет моделей."}
      </p>
    );

  // Разделы «Одежда / Аксессуары»: считаем по всем видимым SKU, дальше
  // работаем внутри активного раздела. Пустой раздел недоступен (кламп).
  const categoryCounts = new Map<ProductCategory, number>();
  for (const s of skus) {
    const c = skuCategory(s);
    categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
  }
  const categories = (
    Object.keys(PRODUCT_CATEGORY_LABELS) as ProductCategory[]
  ).filter((c) => categoryCounts.has(c));
  const activeCategory = categoryCounts.has(category) ? category : categories[0];
  const inCategory = skus.filter((s) => skuCategory(s) === activeCategory);

  // Группы товаров, присутствующие в разделе (в порядке словаря типов).
  const typeCounts = new Map<GarmentType, number>();
  for (const s of inCategory)
    typeCounts.set(s.type, (typeCounts.get(s.type) ?? 0) + 1);
  const types = (Object.keys(GARMENT_TYPE_LABELS) as GarmentType[]).filter(
    (t) => typeCounts.has(t),
  );
  // Выбранная группа могла исчезнуть (удалили модель / сменили раздел) — «все».
  const active = typeFilter && typeCounts.has(typeFilter) ? typeFilter : null;
  const shown = active ? inCategory.filter((s) => s.type === active) : inCategory;

  const chip = (on: boolean) =>
    `rounded-md px-3 py-1.5 text-sm transition ${
      on
        ? "bg-blue-600 font-medium text-white"
        : "border border-line bg-white text-gray-700 hover:border-blue-500"
    }`;

  return (
    <div>
      {categories.length > 1 && (
        <div className="mb-4 inline-flex rounded-lg border border-line bg-white p-1 shadow-sm">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm transition ${
                c === activeCategory
                  ? "bg-blue-600 font-medium text-white"
                  : "text-gray-700 hover:text-blue-700"
              }`}
            >
              {PRODUCT_CATEGORY_LABELS[c]}{" "}
              <span className="opacity-60">{categoryCounts.get(c)}</span>
            </button>
          ))}
        </div>
      )}
      {types.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <button onClick={() => setTypeFilter(null)} className={chip(active === null)}>
            Все <span className="opacity-60">{inCategory.length}</span>
          </button>
          {types.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={chip(active === t)}>
              {GARMENT_TYPE_LABELS[t]}{" "}
              <span className="opacity-60">{typeCounts.get(t)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((sku) => {
        const custom = customIds.has(sku.id);
        return (
          <div
            key={sku.id}
            className="group relative rounded-xl border border-line bg-white p-5 shadow-sm transition hover:border-blue-500 hover:bg-raised"
          >
            <button onClick={() => open(sku.id)} className="block w-full text-left">
              <div className="flex items-center gap-2 text-lg font-semibold">
                {sku.name}
                {custom && (
                  <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-normal text-blue-700">
                    {isCloud() ? (
                      <Cloud size={12} strokeWidth={1.75} />
                    ) : (
                      <HardDrive size={12} strokeWidth={1.75} />
                    )}
                    моя
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-gray-500">
                {GARMENT_TYPE_LABELS[sku.type] ?? sku.type} ·{" "}
                {sku.base_size === ONE_SIZE
                  ? "one size"
                  : `эталон ${sku.base_size}`}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {sku.views.map((v) => (
                  <span key={v.id} className="rounded bg-raised px-2 py-0.5 text-xs text-gray-700">
                    {v.kind}
                  </span>
                ))}
              </div>
              <div className="mt-2 text-xs text-gray-400">
                Размеры: {sku.sizes.join(", ")}
              </div>
            </button>
            {custom && (
              <button
                onClick={() => onDelete(sku.id)}
                title="Удалить модель"
                className="absolute right-2 top-2 hidden rounded px-1.5 py-0.5 text-gray-400 hover:text-red-600 group-hover:block"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
