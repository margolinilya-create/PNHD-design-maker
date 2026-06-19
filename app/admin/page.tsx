"use client";

import { useState } from "react";
import Link from "next/link";
import { SkuList } from "@/components/admin/SkuList";
import { SkuEditor } from "@/components/admin/SkuEditor";
import { FlatCreator } from "@/components/admin/FlatCreator";
import type { SKU } from "@/types";

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; sku: SKU };

export default function AdminPage() {
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-neutral-800 px-4 py-2.5">
        <Link href="/" className="text-sm text-neutral-400 hover:text-white">
          ← PINHEAD
        </Link>
        <span className="text-sm font-semibold">Админка · SKU</span>
        {mode.kind !== "list" && (
          <button
            onClick={() => setMode({ kind: "list" })}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            список
          </button>
        )}
      </header>

      {mode.kind === "list" && (
        <SkuList
          onEdit={(sku) => setMode({ kind: "edit", sku })}
          onCreate={() => setMode({ kind: "create" })}
        />
      )}

      {mode.kind === "create" && (
        <FlatCreator onBack={() => setMode({ kind: "list" })} />
      )}

      {mode.kind === "edit" && (
        <SkuEditor
          initial={mode.sku}
          onBack={() => setMode({ kind: "list" })}
          onSaved={() => setMode({ kind: "list" })}
        />
      )}
    </div>
  );
}
