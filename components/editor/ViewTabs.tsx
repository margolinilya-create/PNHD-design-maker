"use client";

import { useProjectStore } from "@/lib/state/projectStore";

const KIND_LABEL: Record<string, string> = {
  front: "Перед",
  back: "Спина",
  sleeve_left: "Рукав (л)",
  sleeve_right: "Рукав (п)",
  label_neck_inner: "Этикетка (внутр.)",
  label_neck_outer: "Этикетка (внеш.)",
};

export function ViewTabs() {
  const sku = useProjectStore((s) => s.currentSku());
  const viewId = useProjectStore((s) => s.viewId);
  const selectView = useProjectStore((s) => s.selectView);
  const placements = useProjectStore((s) => s.placements);

  if (!sku) return null;

  return (
    <div className="flex gap-1.5">
      {sku.views.map((v) => {
        const count = placements.filter((p) =>
          v.print_areas.some((a) => a.id === p.print_area_id),
        ).length;
        const active = v.id === viewId;
        return (
          <button
            key={v.id}
            onClick={() => selectView(v.id)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              active
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            {KIND_LABEL[v.kind] ?? v.kind}
            {count > 0 && (
              <span className="ml-1.5 rounded-full bg-black/30 px-1.5 text-xs">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
