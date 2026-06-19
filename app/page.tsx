import Link from "next/link";
import { Shirt } from "lucide-react";
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
        <Link
          href="/admin"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:border-blue-500 hover:bg-white"
        >
          <Shirt size={16} strokeWidth={1.75} />
          Админка SKU
        </Link>
      </header>
      <SkuPicker />
    </main>
  );
}
