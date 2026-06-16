"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadCatalog } from "@/lib/catalog/loadCatalog";
import { useProjectStore } from "@/lib/state/projectStore";

export function SkuPicker() {
  const router = useRouter();
  const catalog = useProjectStore((s) => s.catalog);
  const setCatalog = useProjectStore((s) => s.setCatalog);
  const selectSku = useProjectStore((s) => s.selectSku);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (catalog) return;
    loadCatalog()
      .then(setCatalog)
      .catch((e) => setError(String(e)));
  }, [catalog, setCatalog]);

  const open = (skuId: string) => {
    selectSku(skuId);
    router.push("/editor");
  };

  if (error) {
    return (
      <p className="text-red-400">Ошибка загрузки каталога: {error}</p>
    );
  }

  if (!catalog) {
    return <p className="text-neutral-400">Загрузка каталога…</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {catalog.skus.map((sku) => (
        <button
          key={sku.id}
          onClick={() => open(sku.id)}
          className="rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-left transition hover:border-blue-500 hover:bg-neutral-800"
        >
          <div className="text-lg font-semibold">{sku.name}</div>
          <div className="mt-1 text-sm text-neutral-400">
            {sku.type} · эталон {sku.base_size}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sku.views.map((v) => (
              <span
                key={v.id}
                className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
              >
                {v.kind}
              </span>
            ))}
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            Размеры: {sku.sizes.join(", ")}
          </div>
        </button>
      ))}
    </div>
  );
}
