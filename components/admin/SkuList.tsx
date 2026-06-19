"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadCatalog } from "@/lib/catalog/loadCatalog";
import { listModels, deleteModel, saveModel } from "@/lib/persistence/models";
import { cloneSku } from "@/lib/admin/skuEdit";
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

  if (err) return <p className="p-4 text-red-400">Ошибка: {err}</p>;
  if (!entries) return <p className="p-4 text-neutral-400">Загрузка каталога…</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию / id…"
          className="w-64 rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm"
        />
        <button
          onClick={onCreate}
          className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          + Создать из флэта / DXF
        </button>
      </div>

      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(({ sku, source }) => (
          <div
            key={`${source}-${sku.id}`}
            className="rounded-xl border border-neutral-700 bg-neutral-900 p-4"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-100">{sku.name}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  source === "seed"
                    ? "bg-neutral-800 text-neutral-400"
                    : "bg-blue-900/60 text-blue-300"
                }`}
              >
                {source === "seed" ? "seed" : "моя"}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-neutral-500">{sku.id}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {sku.views.map((v) => (
                <span
                  key={v.id}
                  className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300"
                >
                  {v.kind}
                </span>
              ))}
            </div>
            <div className="mt-1 text-[11px] text-neutral-500">
              Размеры: {sku.sizes.join(", ")}
            </div>

            <div className="mt-3 flex items-center gap-2">
              {source === "model" ? (
                <>
                  <button
                    onClick={() => onEdit(sku, reservedFor(sku.id))}
                    className="rounded bg-neutral-700 px-2.5 py-1 text-xs text-neutral-100 hover:bg-neutral-600"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => duplicate(sku)}
                    className="rounded bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
                  >
                    Дублировать
                  </button>
                  <button
                    onClick={() => onDelete(sku.id)}
                    className="ml-auto rounded px-2 py-1 text-xs text-neutral-500 hover:text-red-400"
                  >
                    Удалить
                  </button>
                </>
              ) : (
                <button
                  onClick={() => duplicate(sku)}
                  title="Seed-лекала только для чтения — создаётся редактируемая копия"
                  className="rounded bg-neutral-700 px-2.5 py-1 text-xs text-neutral-100 hover:bg-neutral-600"
                >
                  Копия для правки
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-neutral-500">Ничего не найдено.</p>
        )}
      </div>
    </div>
  );
}
