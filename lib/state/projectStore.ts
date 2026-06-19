// Стор проекта (zustand). Хранит каталог, выбор SKU/вида/размера,
// ассеты и нанесения (BUILD.md §3, Фазы 1/2/5).
"use client";

import { create } from "zustand";
import type { Catalog } from "@/lib/catalog/schema";
import type {
  Asset,
  Placement,
  ProjectComment,
  ProjectStatus,
  SKU,
  View,
} from "@/types";
import { regradePosition } from "@/lib/geometry/view";
import { polygonToZone } from "@/lib/geometry/coords";
import type { ProjectSnapshot } from "@/lib/persistence/projects";

const HISTORY_LIMIT = 50;

interface EditableSnapshot {
  placements: Placement[];
  assets: Record<string, Asset>;
  size: string | null;
  garmentColor: string;
}
function editable(s: EditableSnapshot): EditableSnapshot {
  return {
    placements: s.placements,
    assets: s.assets,
    size: s.size,
    garmentColor: s.garmentColor,
  };
}

let idCounter = 0;
// crypto.randomUUID() для будущей персистентности; иначе — счётчик.
const nextId = (prefix: string) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${idCounter++}`;
};

interface ProjectState {
  catalog: Catalog | null;
  skuId: string | null;
  size: string | null;
  viewId: string | null;
  assets: Record<string, Asset>;
  placements: Placement[];
  selectedPlacementId: string | null;
  client: string;
  orderRef: string;
  status: ProjectStatus;
  comments: ProjectComment[];
  /** Режим «только просмотр» (для согласования) — блокирует правки. */
  readOnly: boolean;

  // история (undo/redo) — снимки редактируемого состояния
  past: EditableSnapshot[];
  future: EditableSnapshot[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  setCatalog: (c: Catalog) => void;
  selectSku: (skuId: string) => void;
  selectView: (viewId: string) => void;
  selectSize: (size: string) => void;
  addAsset: (asset: Omit<Asset, "id">) => string;
  addPlacement: (p: Omit<Placement, "id">) => string;
  updatePlacement: (id: string, patch: Partial<Placement>) => void;
  removePlacement: (id: string) => void;
  selectPlacement: (id: string | null) => void;
  setMeta: (meta: { client?: string; orderRef?: string }) => void;
  setStatus: (status: ProjectStatus) => void;
  addComment: (c: Pick<ProjectComment, "role" | "text">) => void;
  removeComment: (id: string) => void;
  setReadOnly: (v: boolean) => void;
  garmentColor: string;
  setGarmentColor: (c: string) => void;

  // операции со слоями
  duplicatePlacement: (id: string) => void;
  duplicateToAllZones: (id: string) => void;
  reorderPlacement: (id: string, dir: -1 | 1) => void;
  copyPlacementToView: (id: string, viewId: string) => void;
  mirrorPlacement: (id: string) => void;

  // сохранение/восстановление проекта
  snapshot: (id: string, name: string) => ProjectSnapshot;
  restore: (s: ProjectSnapshot) => void;

  // деривативы
  currentSku: () => SKU | null;
  currentView: () => View | null;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  catalog: null,
  skuId: null,
  size: null,
  viewId: null,
  assets: {},
  placements: [],
  selectedPlacementId: null,
  client: "",
  orderRef: "",
  status: "draft",
  comments: [],
  readOnly: false,
  garmentColor: "",
  past: [],
  future: [],

  pushHistory: () =>
    set((s) => ({
      past: [...s.past, editable(s)].slice(-HISTORY_LIMIT),
      future: [],
    })),
  undo: () =>
    set((s) => {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return {
        ...prev,
        past: s.past.slice(0, -1),
        future: [editable(s), ...s.future].slice(0, HISTORY_LIMIT),
        selectedPlacementId: null,
      };
    }),
  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const next = s.future[0];
      return {
        ...next,
        future: s.future.slice(1),
        past: [...s.past, editable(s)].slice(-HISTORY_LIMIT),
        selectedPlacementId: null,
      };
    }),

  setCatalog: (catalog) => set({ catalog }),

  selectSku: (skuId) => {
    // Повторный выбор того же SKU не сбрасывает нанесения.
    if (skuId === get().skuId) return;
    const sku = get().catalog?.skus.find((s) => s.id === skuId);
    set({
      skuId,
      viewId: sku?.views[0]?.id ?? null,
      size: sku?.base_size ?? null,
      placements: [],
      selectedPlacementId: null,
      garmentColor: "",
      comments: [],
      past: [],
      future: [],
    });
  },

  selectView: (viewId) => set({ viewId, selectedPlacementId: null }),

  selectSize: (size) => {
    const { size: fromSize, placements, catalog, skuId } = get();
    if (!fromSize || fromSize === size) {
      set({ size });
      return;
    }
    const sku = catalog?.skus.find((s) => s.id === skuId);
    if (!sku) {
      set({ size });
      return;
    }
    get().pushHistory();
    // Регрейдинг: сохраняем отступ от горловины как константу (BUILD.md §4).
    const regraded = placements.map((p) => {
      const view = sku.views.find((v) =>
        v.print_areas.some((a) => a.id === p.print_area_id),
      ) as View | undefined;
      if (!view) return p;
      const { x_mm, y_mm } = regradePosition(view, fromSize, size, {
        x: p.x_mm,
        y: p.y_mm,
        w: p.width_mm,
        h: p.height_mm,
      });
      return { ...p, x_mm, y_mm };
    });
    set({ size, placements: regraded });
  },

  addAsset: (asset) => {
    const id = nextId("asset");
    // Явно прокидываем size_estimated (оценка размера) в стор.
    set((s) => ({
      assets: {
        ...s.assets,
        [id]: { ...asset, id, size_estimated: asset.size_estimated },
      },
    }));
    return id;
  },

  addPlacement: (p) => {
    get().pushHistory();
    const id = nextId("placement");
    set((s) => ({
      placements: [...s.placements, { ...p, id }],
      selectedPlacementId: id,
    }));
    return id;
  },

  updatePlacement: (id, patch) => {
    get().pushHistory();
    set((s) => ({
      placements: s.placements.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    }));
  },

  removePlacement: (id) => {
    get().pushHistory();
    set((s) => ({
      placements: s.placements.filter((p) => p.id !== id),
      selectedPlacementId:
        s.selectedPlacementId === id ? null : s.selectedPlacementId,
    }));
  },

  selectPlacement: (selectedPlacementId) => set({ selectedPlacementId }),
  setMeta: ({ client, orderRef }) =>
    set((s) => ({
      client: client ?? s.client,
      orderRef: orderRef ?? s.orderRef,
    })),
  setStatus: (status) => set({ status }),
  addComment: ({ role, text }) =>
    set((s) => ({
      comments: [
        ...s.comments,
        { id: nextId("cmt"), role, text, ts: Date.now() },
      ],
    })),
  removeComment: (id) =>
    set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),
  setReadOnly: (readOnly) => set({ readOnly }),
  setGarmentColor: (garmentColor) => {
    get().pushHistory();
    set({ garmentColor });
  },

  duplicatePlacement: (id) => {
    const st = get();
    const src = st.placements.find((p) => p.id === id);
    if (!src) return;
    get().pushHistory();
    const nid = nextId("placement");
    const copy = { ...src, id: nid, x_mm: src.x_mm + 10, y_mm: src.y_mm + 10 };
    const idx = st.placements.findIndex((p) => p.id === id);
    const arr = [...st.placements];
    arr.splice(idx + 1, 0, copy);
    set({ placements: arr, selectedPlacementId: nid });
  },

  duplicateToAllZones: (id) => {
    const st = get();
    const src = st.placements.find((p) => p.id === id);
    const sku = st.currentSku();
    if (!src || !sku) return;
    // Все зоны всех видов, кроме исходной.
    const targets: { areaId: string; zone: ReturnType<typeof polygonToZone> }[] =
      [];
    for (const v of sku.views) {
      for (const a of v.print_areas) {
        if (a.id === src.print_area_id) continue;
        targets.push({ areaId: a.id, zone: polygonToZone(a.polygon_mm) });
      }
    }
    if (!targets.length) return;
    get().pushHistory();
    const copies: Placement[] = targets.map((t) => ({
      ...src,
      id: nextId("placement"),
      print_area_id: t.areaId,
      // Центрируем в целевой зоне, сохраняя размер печати.
      x_mm: t.zone.zx + (t.zone.zw - src.width_mm) / 2,
      y_mm: t.zone.zy + (t.zone.zh - src.height_mm) / 2,
    }));
    set((s) => ({ placements: [...s.placements, ...copies] }));
  },

  reorderPlacement: (id, dir) => {
    const st = get();
    const view = st.currentView();
    if (!view) return;
    const areaIds = new Set(view.print_areas.map((a) => a.id));
    const idxs = st.placements
      .map((p, i) => ({ p, i }))
      .filter((x) => areaIds.has(x.p.print_area_id))
      .map((x) => x.i);
    const pos = idxs.findIndex((i) => st.placements[i].id === id);
    const swapPos = pos + dir;
    if (pos < 0 || swapPos < 0 || swapPos >= idxs.length) return;
    get().pushHistory();
    const arr = [...st.placements];
    const a = idxs[pos];
    const b = idxs[swapPos];
    [arr[a], arr[b]] = [arr[b], arr[a]];
    set({ placements: arr });
  },

  copyPlacementToView: (id, viewId) => {
    const st = get();
    const src = st.placements.find((p) => p.id === id);
    const target = st.currentSku()?.views.find((v) => v.id === viewId);
    if (!src || !target) return;
    get().pushHistory();
    const nid = nextId("placement");
    const copy = { ...src, id: nid, print_area_id: target.print_areas[0].id };
    set({ placements: [...st.placements, copy], selectedPlacementId: nid });
  },

  mirrorPlacement: (id) => {
    const st = get();
    const src = st.placements.find((p) => p.id === id);
    const sku = st.currentSku();
    const srcView = sku?.views.find((v) =>
      v.print_areas.some((a) => a.id === src?.print_area_id),
    );
    if (!src || !srcView) return;
    const otherKind =
      srcView.kind === "sleeve_left"
        ? "sleeve_right"
        : srcView.kind === "sleeve_right"
          ? "sleeve_left"
          : null;
    const target = otherKind
      ? sku!.views.find((v) => v.kind === otherKind)
      : undefined;
    if (!target) return;
    get().pushHistory();
    const nid = nextId("placement");
    const copy = {
      ...src,
      id: nid,
      print_area_id: target.print_areas[0].id,
      flip_h: !src.flip_h,
    };
    set({ placements: [...st.placements, copy], selectedPlacementId: nid });
  },

  snapshot: (id, name) => {
    const st = get();
    return {
      id, name,
      skuId: st.skuId, size: st.size,
      client: st.client, orderRef: st.orderRef, status: st.status,
      placements: st.placements, assets: st.assets,
      garmentColor: st.garmentColor, comments: st.comments, savedAt: Date.now(),
    };
  },
  restore: (s) => {
    const sku = get().catalog?.skus.find((x) => x.id === s.skuId);
    set({
      skuId: s.skuId,
      size: s.size,
      viewId: sku?.views[0]?.id ?? null,
      assets: s.assets,
      placements: s.placements,
      client: s.client,
      orderRef: s.orderRef,
      status: s.status,
      garmentColor: s.garmentColor ?? "",
      comments: s.comments ?? [],
      selectedPlacementId: null,
      past: [],
      future: [],
    });
  },

  currentSku: () => {
    const { catalog, skuId } = get();
    return (catalog?.skus.find((s) => s.id === skuId) as SKU) ?? null;
  },
  currentView: () => {
    const sku = get().currentSku();
    const { viewId } = get();
    return sku?.views.find((v) => v.id === viewId) ?? null;
  },
}));
