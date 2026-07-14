"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Undo2,
  Redo2,
  LayoutGrid,
  Settings,
  ChevronLeft,
} from "lucide-react";
import { useProjectStore } from "@/lib/state/projectStore";
import { loadMergedCatalog } from "@/lib/catalog/mergedCatalog";
import { loadProject } from "@/lib/persistence/projects";
import { ViewTabs } from "@/components/editor/ViewTabs";
import { SidePanel } from "@/components/editor/SidePanel";

// react-konva работает только в браузере.
const EditorCanvas = dynamic(
  () => import("@/components/editor/EditorCanvas").then((m) => m.EditorCanvas),
  { ssr: false, loading: () => <CanvasLoading /> },
);

function CanvasLoading() {
  return (
    <div className="flex h-full items-center justify-center text-gray-400">
      Загрузка холста…
    </div>
  );
}

/** Левый рельс (52px): каталог и админка. */
function Rail() {
  const item = "flex h-10 w-10 items-center justify-center rounded-lg";
  const idle = `${item} text-gray-500 hover:bg-raised hover:text-gray-700`;
  return (
    <nav className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-line bg-white py-3">
      <Link href="/" title="Каталог" className={idle}>
        <LayoutGrid size={18} strokeWidth={1.75} />
      </Link>
      <Link href="/admin" title="Админка SKU" className={`${idle} mt-auto`}>
        <Settings size={18} strokeWidth={1.75} />
      </Link>
    </nav>
  );
}

function UndoRedo() {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const btn =
    "flex h-7 w-7 items-center justify-center rounded text-gray-600 disabled:opacity-30 enabled:hover:bg-raised";
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={undo}
        disabled={!canUndo}
        title="Отменить (Ctrl+Z)"
        className={btn}
      >
        <Undo2 size={16} strokeWidth={1.75} />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Повторить (Ctrl+Shift+Z)"
        className={btn}
      >
        <Redo2 size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** useSearchParams требует Suspense-границу при статическом пререндере. */
export default function EditorPage() {
  return (
    <Suspense fallback={<CanvasLoading />}>
      <EditorInner />
    </Suspense>
  );
}

function EditorInner() {
  const sku = useProjectStore((s) => s.currentSku());
  const dirty = useProjectStore((s) => s.dirty);
  const search = useSearchParams();
  const projectParam = search.get("project");
  // Открытие по ссылке /editor?project=<id>: тянем каталог (если стор пуст —
  // прямой заход мимо главной) и восстанавливаем снапшот проекта.
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!projectParam) return;
    // Уже открыт именно этот проект (навигация туда-обратно) — не перетираем
    // текущие правки повторным restore.
    if (useProjectStore.getState().projectId === projectParam) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        if (!useProjectStore.getState().catalog) {
          const merged = await loadMergedCatalog();
          if (!alive) return;
          useProjectStore.getState().setCatalog({ skus: merged.skus });
        }
        const snap = await loadProject(projectParam);
        if (!alive) return;
        if (snap) useProjectStore.getState().restore(snap);
        else setLoadErr("Проект не найден (удалён или ссылка устарела).");
      } catch (e) {
        if (alive) setLoadErr(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectParam]);

  // Несохранённые правки: предупреждение при закрытии/перезагрузке вкладки.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  if (!sku) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        {loading ? (
          <p className="text-gray-500">Открываю проект…</p>
        ) : (
          <>
            <p className="text-gray-500">
              {loadErr ?? "Изделие не выбрано."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
            >
              <ChevronLeft size={16} strokeWidth={1.75} /> К выбору изделия
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Rail />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-2.5">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink"
            >
              <ChevronLeft size={16} strokeWidth={1.75} /> PINHEAD
            </Link>
            <span className="text-sm font-semibold text-ink">{sku.name}</span>
            <ViewTabs />
          </div>
          <UndoRedo />
        </header>
        <div className="flex min-h-0 flex-1">
          <main className="relative min-w-0 flex-1 bg-shell">
            <EditorCanvas />
          </main>
          <aside className="w-[294px] shrink-0 border-l border-line bg-white">
            <SidePanel />
          </aside>
        </div>
      </div>
    </div>
  );
}
