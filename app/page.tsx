import Link from "next/link";
import { Shirt, Palette, Scissors } from "lucide-react";
import { SkuPicker } from "@/components/catalog/SkuPicker";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PINHEAD</h1>
          <p className="mt-1 text-gray-500">
            Превью и технические рисунки-раскладки мерча. Выбери изделие, чтобы
            открыть редактор.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/styleguide"
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:border-blue-500 hover:bg-white"
          >
            <Palette size={16} strokeWidth={1.75} />
            Дизайн-система
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:border-blue-500 hover:bg-white"
          >
            <Shirt size={16} strokeWidth={1.75} />
            Админка SKU
          </Link>
        </div>
      </header>

      {/* Первичное разделение: печать на готовом изделии / в крое. */}
      <div className="mb-6 inline-flex rounded-lg border border-line bg-white p-1 shadow-sm">
        <span className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
          <Shirt size={16} strokeWidth={1.75} />
          На готовом изделии
        </span>
        <button
          disabled
          title="Печать на крое до пошива — в следующей итерации"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-md px-4 py-2 text-sm text-gray-400"
        >
          <Scissors size={16} strokeWidth={1.75} />
          В крое
          <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
            скоро
          </span>
        </button>
      </div>

      <SkuPicker kind="finished" />
    </main>
  );
}
