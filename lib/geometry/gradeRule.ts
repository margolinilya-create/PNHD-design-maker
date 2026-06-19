// Grade-rule ΔX/ΔY (S2.3, скил merch-geometry). Правило ростовки задаёт дельты
// якорей на ОДИН шаг размера; разворачивается в per-size якоря линейно:
// anchor(size) = base + delta × (индекс размера − индекс базового).
// Знак шага сам обрабатывает «вверх/вниз от базового». Размер печати не меняется —
// двигаются якоря, а инвариант отступа от горловины держит регрейдинг (grading.ts).
import type { Catalog } from "@/lib/catalog/schema";
import type { GradeRule, View, ViewAnchors } from "@/types";

/** Применить правило к базовым якорям на `step` шагов размера. */
export function gradedAnchors(
  base: ViewAnchors,
  rule: GradeRule,
  step: number,
): ViewAnchors {
  const out: ViewAnchors = { ...base };
  if (base.neckline_point) {
    out.neckline_point = {
      x: base.neckline_point.x + (rule.neckline?.dx ?? 0) * step,
      y: base.neckline_point.y + (rule.neckline?.dy ?? 0) * step,
    };
  }
  if (base.center_axis_x != null) {
    out.center_axis_x = base.center_axis_x + (rule.center_axis_dx ?? 0) * step;
  }
  if (base.sleeve_bottom_y != null) {
    out.sleeve_bottom_y =
      base.sleeve_bottom_y + (rule.sleeve_bottom_dy ?? 0) * step;
  }
  if (base.sleeve_center_x != null) {
    out.sleeve_center_x =
      base.sleeve_center_x + (rule.sleeve_center_dx ?? 0) * step;
  }
  return out;
}

/**
 * Развернуть grade_rule вида в `size_anchors` по всем размерам.
 * Явные per-size якоря НЕ перетираются (приоритет ручной разметки).
 */
export function expandGradeRule(
  view: View,
  sizes: string[],
  baseSize: string,
): View {
  if (!view.grade_rule) return view;
  const baseIdx = sizes.indexOf(baseSize);
  if (baseIdx < 0) return view;
  const existing = view.size_anchors ?? {};
  const filled: Record<string, ViewAnchors> = { ...existing };
  sizes.forEach((sz, i) => {
    if (filled[sz]) return; // явные якоря приоритетнее правила
    filled[sz] = gradedAnchors(view.anchors, view.grade_rule!, i - baseIdx);
  });
  return { ...view, size_anchors: filled };
}

/** Развернуть grade_rule во всех SKU/видах каталога. */
export function expandCatalogGradeRules(catalog: Catalog): Catalog {
  return {
    ...catalog,
    skus: catalog.skus.map((sku) => ({
      ...sku,
      views: sku.views.map((v) =>
        expandGradeRule(v as View, sku.sizes, sku.base_size),
      ),
    })),
  };
}
