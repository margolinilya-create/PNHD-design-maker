"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadMergedCatalog } from "@/lib/catalog/mergedCatalog";
import { deleteModel, saveModel } from "@/lib/persistence/models";
import { cloneSku } from "@/lib/admin/skuEdit";
import { Plus, Pencil, Copy, Trash2, RotateCcw } from "lucide-react";
import type { SKU } from "@/types";

interface Entry {
  sku: SKU;
  source: "seed" | "model";
  /** Seed-карточка перекрыта сохранённой правкой (override). */
  overridden: boolean;
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

  const load = useCallback(async () => {
    try {
      const merged = await loadMergedCatalog();
      setEntries(
        merged.skus.map((s) => ({
          sku: s,
          source: merged.seedIds.has(s.id) ? "seed" : "model",
          overridden: merged.overriddenIds.has(s.id),
          raw: merged.rawModels.get(s.id),
        })),
      );
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t || !entries) return entries ?? [];
    return entries.filter(
      (e) =>
        e.sku.name.toLowerCase().includes(t) ||
        e.sku.id.toLowerCase().includes(t),
    );
  }, [entries, q]);

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
    await deleteModel(sku.id);
    await load();
  };

  if (err) return <p className="p-4 text-red-700">Ошибка: {err}</p>;
  if (!entries) return <p className="p-4 text-gray-500">Загрузка каталога…</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
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

      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(({ sku, source, overridden, raw }) => (
          <div
            key={`${source}-${sku.id}`}
            className="rounded-xl border border-line bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
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
              {overridden && (
                <span
                  className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700"
                  title="Заводская карточка перекрыта сохранёнными правками"
                >
                  изменена
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
                onClick={() => duplicate(sku)}
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
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400">Ничего не найдено.</p>
        )}
      </div>
    </div>
  );
}
