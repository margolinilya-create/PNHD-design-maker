"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SkuList } from "@/components/admin/SkuList";
import { SkuEditor } from "@/components/admin/SkuEditor";
import { FlatCreator } from "@/components/admin/FlatCreator";
import type { SKU } from "@/types";

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; sku: SKU; reservedIds: string[] };

export default function AdminPage() {
  const [mode, setMode] = useState<Mode>({ kind: "list" });

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
            onClick={() => setMode({ kind: "list" })}
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
        <FlatCreator onBack={() => setMode({ kind: "list" })} />
      )}

      {mode.kind === "edit" && (
        <SkuEditor
          initial={mode.sku}
          reservedIds={mode.reservedIds}
          onBack={() => setMode({ kind: "list" })}
          onSaved={() => setMode({ kind: "list" })}
        />
      )}
    </div>
  );
}
