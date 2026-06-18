// Pre-export чеклист (S1.4): чистая проверка проекта перед сборкой PDF.
// Не блокирует жёстко — возвращает список проблем; решение за оператором.
// Проверяем только достоверно вычислимое (геометрия, DPI по методу, метрика, метод).
// TODO: контроль прозрачного фона PNG требует пиксельного скана при загрузке — позже.
import type { Asset, Placement, View } from "@/types";
import { placementInfo } from "@/lib/geometry/view";
import { printQuality } from "@/lib/catalog/dpi";
import { resolveMethod, printMethodProfile } from "@/lib/catalog/printMethod";

export type PreflightLevel = "error" | "warn";

export interface PreflightIssue {
  level: PreflightLevel;
  message: string;
  placementId?: string;
}

export interface PreflightInput {
  views: View[]; // sku.views
  placements: Placement[];
  assets: Record<string, Asset>;
  size?: string;
}

function viewForPlacement(views: View[], p: Placement): View | undefined {
  return views.find((v) => v.print_areas.some((a) => a.id === p.print_area_id));
}

function placementLabel(view: View | undefined, p: Placement): string {
  return (
    p.name ||
    view?.print_areas.find((a) => a.id === p.print_area_id)?.name ||
    "нанесение"
  );
}

/** Сканирует проект и возвращает список проблем (errors впереди). */
export function preflight(input: PreflightInput): PreflightIssue[] {
  const { views, placements, assets, size } = input;
  const issues: PreflightIssue[] = [];

  if (placements.length === 0) {
    issues.push({ level: "error", message: "Нет нанесений для экспорта." });
    return issues;
  }

  for (const p of placements) {
    const view = viewForPlacement(views, p);
    const label = placementLabel(view, p);
    if (!view) {
      issues.push({
        level: "error",
        placementId: p.id,
        message: `«${label}»: зона нанесения не найдена в каталоге.`,
      });
      continue;
    }

    const areaDefault = view.print_areas.find(
      (a) => a.id === p.print_area_id,
    )?.default_method;
    const method = resolveMethod(p.method, areaDefault);
    const profile = printMethodProfile(method);

    // Метод не задан явно и нет дефолта зоны → молчаливый фоллбэк на DTF.
    if (!p.method && !areaDefault) {
      issues.push({
        level: "warn",
        placementId: p.id,
        message: `«${label}»: метод печати не задан — будет ${profile.label}.`,
      });
    }

    // Разрешение по методу (вышивка — не по DPI, пропускаем).
    const asset = assets[p.asset_id];
    const { quality, dpi } = printQuality(asset, p.width_mm, method);
    if (quality === "low") {
      issues.push({
        level: "warn",
        placementId: p.id,
        message: `«${label}»: низкое разрешение ${Math.round(
          dpi ?? 0,
        )} DPI для метода «${profile.label}» — печать может быть размытой.`,
      });
    }

    // Физический размер выведен из дефолта, а не из файла.
    if (asset?.size_estimated) {
      issues.push({
        level: "warn",
        placementId: p.id,
        message: `«${label}»: физический размер оценочный — проверьте Ш×В.`,
      });
    }

    // Выход за печатную зону.
    const out = placementInfo(
      view,
      { x: p.x_mm, y: p.y_mm, w: p.width_mm, h: p.height_mm },
      p.rotation_deg,
      size,
      p.print_area_id,
    ).check.out_of_zone;
    if (out) {
      issues.push({
        level: "warn",
        placementId: p.id,
        message: `«${label}»: выходит за печатную зону.`,
      });
    }
  }

  // errors впереди warn.
  return issues.sort((a, b) =>
    a.level === b.level ? 0 : a.level === "error" ? -1 : 1,
  );
}

/** Есть ли блокирующие ошибки (errors). */
export function hasBlockingErrors(issues: PreflightIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}
