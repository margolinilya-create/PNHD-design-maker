"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadCatalog } from "@/lib/catalog/loadCatalog";
import { listModels, deleteModel, saveModel } from "@/lib/persistence/models";
import { cloneSku } from "@/lib/admin/skuEdit";
import { Plus, Pencil, Copy, Trash2 } from "lucide-react";
import type { SKU } from "@/types";

interface Entry {
  sku: SKU;
  source: "seed" | "model";
}

export function SkuList({
  onEdit,
  onCreate,
}: {
  onEdit: (sku: SKU, reservedIds: string[]) => void;
  onCreate: () => void;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const cat = await loadCatalog();
      const seedIds = new Set(cat.skus.map((s) => s.id));
      const models = await listModels();
      const seed: Entry[] = cat.skus.map((s) => ({ sku: s, source: "seed" }));
      const custom: Entry[] = models
        .filter((m) => !seedIds.has(m.id))
        .map((m) => ({ sku: m, source: "model" }));
      setEntries([...seed, ...custom]);
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
        {filtered.map(({ sku, source }) => (
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
                {source === "seed" ? "seed" : "моя"}
              </span>
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
              {source === "model" ? (
                <>
                  <button
                    onClick={() => onEdit(sku, reservedFor(sku.id))}
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
                  <button
                    onClick={() => onDelete(sku.id)}
                    className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={14} strokeWidth={1.75} /> Удалить
                  </button>
                </>
              ) : (
                <button
                  onClick={() => duplicate(sku)}
                  title="Seed-лекала только для чтения — создаётся редактируемая копия"
                  className="inline-flex items-center gap-1 rounded bg-raised px-2.5 py-1 text-xs text-ink hover:bg-gray-200"
                >
                  <Copy size={14} strokeWidth={1.75} /> Копия для правки
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
