"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SkuList } from "@/components/admin/SkuList";
import { SkuEditor } from "@/components/admin/SkuEditor";
import { FlatCreator } from "@/components/admin/FlatCreator";
import { loadCatalog } from "@/lib/catalog/loadCatalog";
import { listModels } from "@/lib/persistence/models";
import type { SKU } from "@/types";

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; sku: SKU; reservedIds: string[] };

export default function AdminPage() {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  // Занятые id (seed + модели) — для проверки уникальности при передаче из
  // создания в полноценный редактор.
  const [reserved, setReserved] = useState<string[]>([]);

  const loadReserved = useCallback(async () => {
    try {
      const [cat, models] = await Promise.all([loadCatalog(), listModels()]);
      const ids = new Set<string>(cat.skus.map((s) => s.id));
      models.forEach((m) => ids.add(m.id));
      setReserved([...ids]);
    } catch {
      /* список занятых id не критичен для рендера */
    }
  }, []);

  useEffect(() => {
    loadReserved();
  }, [loadReserved]);

  // Создание → продолжить в полном редакторе (мультивид/per-size/этикетка).
  const continueInEditor = (sku: SKU) =>
    setMode({
      kind: "edit",
      sku,
      reservedIds: reserved.filter((id) => id !== sku.id),
    });

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-line bg-white px-4 py-2.5">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink"
        >
          <ChevronLeft size={16} strokeWidth={1.75} /> PINHEAD
        </Link>
        <span className="text-sm font-semibold text-ink">Админка · SKU</span>
        {mode.kind !== "list" && (
          <button
            onClick={() => {
              loadReserved();
              setMode({ kind: "list" });
            }}
            className="text-xs text-gray-400 hover:text-gray-700"
          >
            список
          </button>
        )}
      </header>

      {mode.kind === "list" && (
        <SkuList
          onEdit={(sku, reservedIds) =>
            setMode({ kind: "edit", sku, reservedIds })
          }
          onCreate={() => setMode({ kind: "create" })}
        />
      )}

      {mode.kind === "create" && (
        <FlatCreator
          onBack={() => setMode({ kind: "list" })}
          onContinue={continueInEditor}
        />
      )}

      {mode.kind === "edit" && (
        <SkuEditor
          initial={mode.sku}
          reservedIds={mode.reservedIds}
          onBack={() => {
            loadReserved();
            setMode({ kind: "list" });
          }}
          onSaved={() => {
            loadReserved();
            setMode({ kind: "list" });
          }}
        />
      )}
    </div>
  );
}
