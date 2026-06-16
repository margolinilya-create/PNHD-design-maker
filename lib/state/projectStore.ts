// Стор проекта (zustand). Хранит каталог, выбор SKU/вида/размера,
// ассеты и нанесения (BUILD.md §3, Фазы 1/2/5).
"use client";

import { create } from "zustand";
import type { Catalog } from "@/lib/catalog/schema";
import type { Asset, Placement, ProjectStatus, SKU, View } from "@/types";
import { regradePosition } from "@/lib/geometry/view";

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idCounter++}`;

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

  setCatalog: (catalog) => set({ catalog }),

  selectSku: (skuId) => {
    const sku = get().catalog?.skus.find((s) => s.id === skuId);
    set({
      skuId,
      viewId: sku?.views[0]?.id ?? null,
      size: sku?.base_size ?? null,
      placements: [],
      selectedPlacementId: null,
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
    set((s) => ({ assets: { ...s.assets, [id]: { ...asset, id } } }));
    return id;
  },

  addPlacement: (p) => {
    const id = nextId("placement");
    set((s) => ({
      placements: [...s.placements, { ...p, id }],
      selectedPlacementId: id,
    }));
    return id;
  },

  updatePlacement: (id, patch) =>
    set((s) => ({
      placements: s.placements.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    })),

  removePlacement: (id) =>
    set((s) => ({
      placements: s.placements.filter((p) => p.id !== id),
      selectedPlacementId:
        s.selectedPlacementId === id ? null : s.selectedPlacementId,
    })),

  selectPlacement: (selectedPlacementId) => set({ selectedPlacementId }),
  setMeta: ({ client, orderRef }) =>
    set((s) => ({
      client: client ?? s.client,
      orderRef: orderRef ?? s.orderRef,
    })),
  setStatus: (status) => set({ status }),

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
