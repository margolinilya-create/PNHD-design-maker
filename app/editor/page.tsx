"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useProjectStore } from "@/lib/state/projectStore";
import { ViewTabs } from "@/components/editor/ViewTabs";
import { SidePanel } from "@/components/editor/SidePanel";

// react-konva работает только в браузере.
const EditorCanvas = dynamic(
  () => import("@/components/editor/EditorCanvas").then((m) => m.EditorCanvas),
  { ssr: false, loading: () => <CanvasLoading /> },
);

function CanvasLoading() {
  return (
    <div className="flex h-full items-center justify-center text-neutral-500">
      Загрузка холста…
    </div>
  );
}

function UndoRedo() {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const readOnly = useProjectStore((s) => s.readOnly);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const btn = "rounded px-2 py-1 text-sm disabled:opacity-30";
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={undo}
        disabled={!canUndo || readOnly}
        title="Отменить (Ctrl+Z)"
        className={`${btn} bg-neutral-800 text-neutral-200 hover:bg-neutral-700`}
      >
        ↶
      </button>
      <button
        onClick={redo}
        disabled={!canRedo || readOnly}
        title="Повторить (Ctrl+Shift+Z)"
        className={`${btn} bg-neutral-800 text-neutral-200 hover:bg-neutral-700`}
      >
        ↷
      </button>
    </div>
  );
}

export default function EditorPage() {
  const sku = useProjectStore((s) => s.currentSku());

  if (!sku) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-neutral-400">Изделие не выбрано.</p>
        <Link href="/" className="text-blue-400 hover:underline">
          ← К выбору изделия
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-neutral-400 hover:text-white">
            ← PINHEAD
          </Link>
          <span className="text-sm font-semibold">{sku.name}</span>
          <ViewTabs />
        </div>
        <UndoRedo />
      </header>
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 bg-neutral-950">
          <EditorCanvas />
        </main>
        <aside className="w-80 shrink-0 border-l border-neutral-800 bg-neutral-900">
          <SidePanel />
        </aside>
      </div>
    </div>
  );
}
