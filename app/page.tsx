import Link from "next/link";
import { SkuPicker } from "@/components/catalog/SkuPicker";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PINHEAD</h1>
          <p className="mt-1 text-neutral-400">
            Превью и технические рисунки-раскладки мерча. Выбери изделие, чтобы
            открыть редактор.
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:border-blue-500 hover:bg-neutral-900"
        >
          Админка SKU
        </Link>
      </header>
      <SkuPicker />
    </main>
  );
}
