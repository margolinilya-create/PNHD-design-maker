// Загрузка и валидация каталога seed (BUILD.md §3, Фаза 1).
import { catalogSchema, type Catalog } from "./schema";
import { expandCatalogGradeRules } from "@/lib/geometry/gradeRule";
import type { SKU, View } from "@/types";

export const SEED_CATALOG_URL = "/seed/skus.json";

/** Загрузить и провалидировать skus.json. Бросает при несоответствии схеме. */
export async function loadCatalog(
  url: string = SEED_CATALOG_URL,
): Promise<Catalog> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Не удалось загрузить каталог: ${res.status}`);
  }
  const json = await res.json();
  // Разворачиваем grade_rule в per-size якоря — дальше всё работает как обычно.
  return expandCatalogGradeRules(catalogSchema.parse(json));
}

export function findSku(catalog: Catalog, skuId: string): SKU | undefined {
  return catalog.skus.find((s) => s.id === skuId) as SKU | undefined;
}

export function findView(sku: SKU, viewId: string): View | undefined {
  return sku.views.find((v) => v.id === viewId);
}
