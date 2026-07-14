"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { SkuList } from "@/components/admin/SkuList";
import { SkuEditor } from "@/components/admin/SkuEditor";
import { FlatCreator } from "@/components/admin/FlatCreator";
import { loadMergedCatalog } from "@/lib/catalog/mergedCatalog";
import type { SKU } from "@/types";

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; sku: SKU; reservedIds: string[]; lockId?: boolean };

export default function AdminPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  // Занятые id (seed + модели) — для проверки уникальности при передаче из
  // создания в полноценный редактор.
  const [reserved, setReserved] = useState<string[]>([]);

  const loadReserved = useCallback(
    async (isAlive: () => boolean = () => true) => {
      try {
        const merged = await loadMergedCatalog();
        if (isAlive()) setReserved(merged.skus.map((s) => s.id));
      } catch {
        /* список занятых id не критичен для рендера */
      }
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    loadReserved(() => alive);
    return () => {
      alive = false;
    };
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
        <button
          onClick={async () => {
            // Сбрасываем cookie-сессию и уходим на главную; middleware дальше
            // сам не пустит в /admin без нового логина.
            try {
              await fetch("/api/admin/logout", { method: "POST" });
            } catch {
              /* сеть упала — cookie останется, но и navigation не критичен */
            }
            router.replace("/");
            router.refresh();
          }}
          className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"
          title="Выйти из админки"
        >
          <LogOut size={14} strokeWidth={1.75} /> выйти
        </button>
      </header>

      {mode.kind === "list" && (
        <SkuList
          onEdit={(sku, reservedIds, lockId) =>
            setMode({ kind: "edit", sku, reservedIds, lockId })
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
          lockId={mode.lockId}
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
