// Единый merge каталога: seed (заводские карточки из /seed/skus.json) +
// пользовательские модели из персистентности. Override-семантика: модель
// с id seed-карточки ПЕРЕКРЫВАЕТ её на месте (порядок seed сохраняется);
// «Сбросить к заводской» = deleteModel(id) → merge снова отдаёт seed.
// hidden здесь НЕ фильтруется — админке нужны скрытые; фильтруют потребители.
import type { SKU } from "@/types";
import { loadCatalog } from "./loadCatalog";
import { listModels } from "@/lib/persistence/models";
import { expandCatalogGradeRules } from "@/lib/geometry/gradeRule";

export interface MergedCatalog {
  /** Seed-порядок (override заменяет seed на месте), затем кастомные. */
  skus: SKU[];
  seedIds: Set<string>;
  /** Seed-id, перекрытые сохранённой моделью. */
  overriddenIds: Set<string>;
  /** Модели с собственными (не seed) id. */
  customIds: Set<string>;
  /**
   * Сырые строки моделей (без развёрнутых grade_rule → size_anchors).
   * Редактор должен открывать их, а не развёрнутые копии — иначе явные
   * size_anchors «запекутся» и правки grade_rule перестанут действовать.
   */
  rawModels: Map<string, SKU>;
}

/** Чистый merge (юнит-тестируемый): override по id + разворачивание правил. */
export function mergeCatalog(seedSkus: SKU[], models: SKU[]): MergedCatalog {
  const seedIds = new Set(seedSkus.map((s) => s.id));
  const rawModels = new Map(models.map((m) => [m.id, m] as const));
  const overriddenIds = new Set<string>();
  const customIds = new Set<string>();

  const merged: SKU[] = seedSkus.map((s) => {
    const override = rawModels.get(s.id);
    if (override) {
      overriddenIds.add(s.id);
      return override;
    }
    return s;
  });
  for (const m of models) {
    if (!seedIds.has(m.id)) {
      customIds.add(m.id);
      merged.push(m);
    }
  }

  // Один проход разворачивания grade_rule: для seed идемпотентен (правила
  // уже раскрыты в loadCatalog / отсутствуют), моделям с grade_rule наконец
  // строит per-size якоря (раньше кастомные модели текли сырыми).
  const expanded = expandCatalogGradeRules({ skus: merged }).skus;

  return { skus: expanded, seedIds, overriddenIds, customIds, rawModels };
}

/**
 * Загрузка seed + моделей с best-effort облаком: недоступный или зависший
 * Supabase не должен блокировать каталог (таймаут, затем только seed).
 */
export async function loadMergedCatalog(timeoutMs = 5000): Promise<MergedCatalog> {
  const cat = await loadCatalog();
  let models: SKU[] = [];
  try {
    models = await Promise.race([
      listModels(),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("cloud timeout")), timeoutMs),
      ),
    ]);
  } catch {
    /* облако недоступно — работаем на seed */
  }
  return mergeCatalog(cat.skus, models);
}

/**
 * Отличается ли override от заводской версии чем-то, кроме флага hidden.
 * Нужен для бейджей: «скрыта» ≠ «изменена».
 */
export function overrideDiffersFromSeed(seed: SKU, override: SKU): boolean {
  const strip = (s: SKU) => JSON.stringify({ ...s, hidden: undefined });
  return strip(seed) !== strip(override);
}
