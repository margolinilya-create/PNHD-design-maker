"use client";

// Сохранённые проекты на главной: открыть по клику (/editor?project=<id>),
// удалить крестиком. До этого проекты открывались только изнутри редактора,
// куда нельзя было попасть, не выбрав SKU (а выбор стирал раскладку).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, X } from "lucide-react";
import {
  listProjects,
  deleteProject,
  type ProjectSnapshot,
} from "@/lib/persistence/projects";

export function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSnapshot[] | null>(null);

  useEffect(() => {
    let alive = true;
    listProjects()
      .then((p) => alive && setProjects(p))
      .catch(() => alive && setProjects([]));
    return () => {
      alive = false;
    };
  }, []);

  const onDelete = async (id: string) => {
    if (!window.confirm("Удалить проект? Действие необратимо.")) return;
    await deleteProject(id);
    setProjects((prev) => prev?.filter((p) => p.id !== id) ?? null);
  };

  // Тихо прячемся, пока грузимся или проектов нет — главная не мигает.
  if (!projects?.length) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <FolderOpen size={16} strokeWidth={1.75} />
        Мои проекты <span className="font-normal text-gray-400">{projects.length}</span>
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div
            key={p.id}
            className="group relative rounded-lg border border-line bg-white px-4 py-3 shadow-sm transition hover:border-blue-500"
          >
            <button
              onClick={() => router.push(`/editor?project=${encodeURIComponent(p.id)}`)}
              className="block w-full text-left"
            >
              <div className="truncate text-sm font-medium text-ink">
                {p.name || "(без названия)"}
              </div>
              <div className="mt-0.5 text-xs text-gray-400">
                {[
                  p.client && `клиент: ${p.client}`,
                  p.orderRef && `заказ ${p.orderRef}`,
                  new Date(p.savedAt).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </button>
            <button
              onClick={() => onDelete(p.id)}
              title="Удалить проект"
              className="absolute right-2 top-2 hidden rounded px-1 py-0.5 text-gray-400 hover:text-red-600 group-hover:block"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
