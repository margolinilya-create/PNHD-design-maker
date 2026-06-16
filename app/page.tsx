import { SkuPicker } from "@/components/catalog/SkuPicker";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">PINHEAD</h1>
        <p className="mt-1 text-neutral-400">
          Превью и технические рисунки-раскладки мерча. Выбери изделие, чтобы
          открыть редактор.
        </p>
      </header>
      <SkuPicker />
    </main>
  );
}
