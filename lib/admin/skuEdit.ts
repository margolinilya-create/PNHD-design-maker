// Хелперы редактирования SKU для админки. Чистые иммутабельные операции над
// моделью SKU + валидация по zod-схеме каталога. Геометрия — в мм (BUILD.md §3).
import type {
  BaseSize,
  GarmentType,
  GradeRule,
  PrintArea,
  SKU,
  View,
  ViewKind,
} from "@/types";
import { catalogSchema } from "@/lib/catalog/schema";

const isSleeve = (k: ViewKind) => k === "sleeve_left" || k === "sleeve_right";
const isLabel = (k: ViewKind) => k.startsWith("label");

/** Глубокая копия SKU с новым id/именем (для «дублировать» / клона seed). */
export function cloneSku(sku: SKU, newId: string, newName: string): SKU {
  const copy: SKU = JSON.parse(JSON.stringify(sku));
  copy.id = newId;
  copy.name = newName;
  return copy;
}

/** Валидация SKU по схеме каталога. Возвращает список ошибок (пусто — ок). */
export function validateSku(sku: SKU): string[] {
  const res = catalogSchema.safeParse({ skus: [sku] });
  if (res.success) return [];
  return res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

/**
 * Проверка id модели: формат + отсутствие коллизии (seed-id или другая модель).
 * `reserved` — занятые id (seed + прочие модели, кроме текущей). null = ок.
 */
export function idError(id: string, reserved: string[]): string | null {
  if (!id.trim()) return "id пустой";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id))
    return "id: только латиница в нижнем регистре, цифры и дефис";
  if (reserved.includes(id)) return "id уже занят (seed или другая модель)";
  return null;
}

/** Прямоугольная зона печати → PrintArea с polygon_mm. */
export function rectZone(
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  safe_inset_mm = 10,
): PrintArea {
  return {
    id,
    name,
    polygon_mm: [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    safe_inset_mm,
  };
}

/** AABB зоны (x,y,w,h в мм) из polygon_mm. */
export function zoneRect(area: PrintArea) {
  const xs = area.polygon_mm.map((p) => p[0]);
  const ys = area.polygon_mm.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Дефолтные якоря под тип вида. */
export function defaultAnchors(kind: ViewKind) {
  if (isLabel(kind)) return {};
  if (isSleeve(kind)) return { sleeve_bottom_y: 180, sleeve_center_x: 60 };
  return { neckline_point: { x: 150, y: 30 }, center_axis_x: 150 };
}

/** Новый пустой вид с одной зоной. */
export function emptyView(skuId: string, kind: ViewKind): View {
  return {
    id: `${skuId}-${kind}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    flat_svg: "",
    scale_mm_per_unit: 1,
    anchors: defaultAnchors(kind),
    print_areas: [rectZone("zone-1", "Зона", 40, 60, 220, 280)],
  };
}

/** Иммутабельно обновить вид по id. */
export function updateView(
  sku: SKU,
  viewId: string,
  patch: Partial<View>,
): SKU {
  return {
    ...sku,
    views: sku.views.map((v) => (v.id === viewId ? { ...v, ...patch } : v)),
  };
}

/** Добавить размер (если ещё нет). */
export function addSize(sku: SKU, size: string): SKU {
  const s = size.trim();
  if (!s || sku.sizes.includes(s)) return sku;
  return { ...sku, sizes: [...sku.sizes, s] };
}

/** Удалить размер (нельзя удалить базовый). */
export function removeSize(sku: SKU, size: string): SKU {
  if (size === sku.base_size) return sku;
  return { ...sku, sizes: sku.sizes.filter((s) => s !== size) };
}

/** Добавить вид. */
export function addView(sku: SKU, kind: ViewKind): SKU {
  return { ...sku, views: [...sku.views, emptyView(sku.id, kind)] };
}

/** Удалить вид (минимум один остаётся). */
export function removeView(sku: SKU, viewId: string): SKU {
  if (sku.views.length <= 1) return sku;
  return { ...sku, views: sku.views.filter((v) => v.id !== viewId) };
}

/** Сдвинуть массив-элемент на dir (без выхода за края). */
function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (index < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

/** Переставить вид вверх/вниз (порядок вкладок в редакторе и страниц PDF). */
export function moveView(sku: SKU, viewId: string, dir: -1 | 1): SKU {
  const i = sku.views.findIndex((v) => v.id === viewId);
  if (i < 0) return sku;
  const views = moveItem(sku.views, i, dir);
  return views === sku.views ? sku : { ...sku, views };
}

/**
 * Переставить зону вверх/вниз — синхронно в базовых `print_areas`
 * и в каждом per-size наборе (порядок по id общий для всех размеров).
 */
export function moveZone(
  sku: SKU,
  viewId: string,
  areaId: string,
  dir: -1 | 1,
): SKU {
  const v = sku.views.find((x) => x.id === viewId);
  if (!v) return sku;
  const i = v.print_areas.findIndex((a) => a.id === areaId);
  if (i < 0) return sku;
  const print_areas = moveItem(v.print_areas, i, dir);
  if (print_areas === v.print_areas) return sku;
  let size_print_areas = v.size_print_areas;
  if (size_print_areas) {
    size_print_areas = Object.fromEntries(
      Object.entries(size_print_areas).map(([size, areas]) => {
        const j = areas.findIndex((a) => a.id === areaId);
        return [size, j < 0 ? areas : moveItem(areas, j, dir)];
      }),
    );
  }
  return updateView(sku, viewId, { print_areas, size_print_areas });
}

/** Суффикс для новых id при клонировании (8 base36 — коллизии практически исключены). */
const cloneSuffix = () =>
  Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);

/**
 * Дубликат вида: новый view.id и НОВЫЕ id всех зон (id зон уникальны
 * в рамках SKU — по ним резолвится вид у нанесений/preflight), карта
 * старый→новый применяется и к per-size наборам.
 */
export function duplicateView(sku: SKU, viewId: string): SKU {
  const v = sku.views.find((x) => x.id === viewId);
  if (!v) return sku;
  const suffix = cloneSuffix();
  const cloned = structuredClone(v);
  const remap = (areas: PrintArea[]): PrintArea[] =>
    areas.map((a) => ({ ...a, id: `${a.id}-copy-${suffix}` }));
  const copy: View = {
    ...cloned,
    id: `${v.id}-copy-${suffix}`,
    print_areas: remap(cloned.print_areas),
    size_print_areas: cloned.size_print_areas
      ? Object.fromEntries(
          Object.entries(cloned.size_print_areas).map(([s, areas]) => [
            s,
            remap(areas),
          ]),
        )
      : undefined,
  };
  const i = sku.views.findIndex((x) => x.id === viewId);
  const views = [...sku.views];
  views.splice(i + 1, 0, copy);
  return { ...sku, views };
}

/**
 * Зеркальная копия рукава L↔R: новый вид с противоположным kind, геометрия
 * отражена по вертикальной оси флэта (x' = W − x, всё в ММ: якоря, оси и
 * polygon_mm хранятся в мм → W = ширина флэта в мм, т.е. naturalWidth ×
 * scale_mm_per_unit). Флэт переиспользуется как есть — предполагаем
 * симметричный рукав (асимметрию доводят на холсте). id зон новые
 * (уникальны в рамках SKU).
 */
export function mirrorSleeveView(
  sku: SKU,
  viewId: string,
  flatWidthMm: number,
): SKU {
  const v = sku.views.find((x) => x.id === viewId);
  if (!v || !(v.kind === "sleeve_left" || v.kind === "sleeve_right")) return sku;
  if (!(flatWidthMm > 0)) return sku;
  const W = flatWidthMm;
  const kind: ViewKind = v.kind === "sleeve_left" ? "sleeve_right" : "sleeve_left";
  const suffix = cloneSuffix();

  const mirrorAnchors = (a: View["anchors"]): View["anchors"] => ({
    ...a,
    sleeve_center_x:
      a.sleeve_center_x === undefined ? undefined : W - a.sleeve_center_x,
    center_axis_x:
      a.center_axis_x === undefined ? undefined : W - a.center_axis_x,
    neckline_point: a.neckline_point
      ? { x: W - a.neckline_point.x, y: a.neckline_point.y }
      : undefined,
    axes: a.axes?.map((ax) => ({ ...ax, x: W - ax.x })),
  });
  const mirrorAreas = (areas: PrintArea[]): PrintArea[] =>
    areas.map((a) => ({
      ...structuredClone(a),
      id: `${a.id}-mir-${suffix}`,
      polygon_mm: a.polygon_mm.map(([x, y]) => [W - x, y] as [number, number]),
    }));

  const cloned = structuredClone(v);
  const mirrored: View = {
    ...cloned,
    id: `${v.id}-mir-${suffix}`,
    kind,
    anchors: mirrorAnchors(cloned.anchors),
    size_anchors: cloned.size_anchors
      ? Object.fromEntries(
          Object.entries(cloned.size_anchors).map(([s, a]) => [
            s,
            mirrorAnchors(a),
          ]),
        )
      : undefined,
    print_areas: mirrorAreas(cloned.print_areas),
    size_print_areas: cloned.size_print_areas
      ? Object.fromEntries(
          Object.entries(cloned.size_print_areas).map(([s, areas]) => [
            s,
            mirrorAreas(areas),
          ]),
        )
      : undefined,
    // Правило ростовки: горизонтальные дельты меняют знак.
    grade_rule: cloned.grade_rule
      ? {
          ...cloned.grade_rule,
          sleeve_center_dx:
            cloned.grade_rule.sleeve_center_dx === undefined
              ? undefined
              : -cloned.grade_rule.sleeve_center_dx,
          center_axis_dx:
            cloned.grade_rule.center_axis_dx === undefined
              ? undefined
              : -cloned.grade_rule.center_axis_dx,
          neckline: cloned.grade_rule.neckline
            ? {
                ...cloned.grade_rule.neckline,
                dx:
                  cloned.grade_rule.neckline.dx === undefined
                    ? undefined
                    : -cloned.grade_rule.neckline.dx,
              }
            : undefined,
        }
      : undefined,
  };

  const i = sku.views.findIndex((x) => x.id === viewId);
  const views = [...sku.views];
  views.splice(i + 1, 0, mirrored);
  return { ...sku, views };
}

/** Добавить зону в вид. */
export function addZone(sku: SKU, viewId: string): SKU {
  const v = sku.views.find((x) => x.id === viewId);
  if (!v) return sku;
  const id = `zone-${v.print_areas.length + 1}-${Math.random()
    .toString(36)
    .slice(2, 5)}`;
  return updateView(sku, viewId, {
    print_areas: [...v.print_areas, rectZone(id, "Зона", 40, 60, 200, 240)],
  });
}

/** Удалить зону (минимум одна на вид). */
export function removeZone(sku: SKU, viewId: string, areaId: string): SKU {
  const v = sku.views.find((x) => x.id === viewId);
  if (!v || v.print_areas.length <= 1) return sku;
  return updateView(sku, viewId, {
    print_areas: v.print_areas.filter((a) => a.id !== areaId),
  });
}

/** Мета-поля зоны — общие для базы и per-size снапшотов (геометрия — своя). */
const ZONE_META_KEYS = ["name", "default_method", "methods"] as const;

/**
 * Обновить зону вида по id. Мета-часть патча (имя/методы) доносится и до
 * per-size копий зоны с тем же id: снапшоты copy-on-write замораживают мету,
 * а состав зон (id/имя/метод) по конвенции остаётся общим на вид.
 */
export function updateZone(
  sku: SKU,
  viewId: string,
  areaId: string,
  patch: Partial<PrintArea>,
): SKU {
  const v = sku.views.find((x) => x.id === viewId);
  if (!v) return sku;
  const meta: Partial<PrintArea> = {};
  for (const k of ZONE_META_KEYS) {
    if (k in patch) (meta as Record<string, unknown>)[k] = patch[k];
  }
  const hasMeta = Object.keys(meta).length > 0;
  const sizePatch =
    hasMeta && v.size_print_areas
      ? {
          size_print_areas: Object.fromEntries(
            Object.entries(v.size_print_areas).map(([size, areas]) => [
              size,
              areas.map((a) => (a.id === areaId ? { ...a, ...meta } : a)),
            ]),
          ),
        }
      : undefined;
  return updateView(sku, viewId, {
    print_areas: v.print_areas.map((a) =>
      a.id === areaId ? { ...a, ...patch } : a,
    ),
    ...sizePatch,
  });
}

/** Установить/очистить grade-rule вида. */
export function setGradeRule(
  sku: SKU,
  viewId: string,
  rule: GradeRule | undefined,
): SKU {
  return updateView(sku, viewId, { grade_rule: rule });
}

// ── Per-size: эффективные значения (override на размер → фоллбэк на базовые) ──

/** Якоря вида для размера: size_anchors[size] ?? базовые. */
export function effAnchors(view: View, size: string, baseSize: string) {
  if (size === baseSize) return view.anchors;
  return view.size_anchors?.[size] ?? view.anchors;
}

/** Зоны вида для размера: size_print_areas[size] ?? базовые. */
export function effZones(view: View, size: string, baseSize: string): PrintArea[] {
  if (size === baseSize) return view.print_areas;
  return view.size_print_areas?.[size] ?? view.print_areas;
}

/** Флэт вида для размера: size_flats[size] ?? базовый. */
export function effFlat(view: View, size: string, baseSize: string): string {
  if (size === baseSize) return view.flat_svg;
  return view.size_flats?.[size] ?? view.flat_svg;
}

function findView(sku: SKU, viewId: string) {
  return sku.views.find((v) => v.id === viewId);
}

/** Записать якоря для размера (базовый → anchors, иначе → size_anchors). */
export function setSizeAnchors(
  sku: SKU,
  viewId: string,
  size: string,
  baseSize: string,
  anchors: View["anchors"],
): SKU {
  const v = findView(sku, viewId);
  if (!v) return sku;
  if (size === baseSize) return updateView(sku, viewId, { anchors });
  return updateView(sku, viewId, {
    size_anchors: { ...v.size_anchors, [size]: anchors },
  });
}

/** Записать флэт для размера. */
export function setSizeFlat(
  sku: SKU,
  viewId: string,
  size: string,
  baseSize: string,
  flat: string,
): SKU {
  const v = findView(sku, viewId);
  if (!v) return sku;
  if (size === baseSize) return updateView(sku, viewId, { flat_svg: flat });
  return updateView(sku, viewId, {
    size_flats: { ...v.size_flats, [size]: flat },
  });
}

/** Записать массив зон для размера. */
export function setSizeZones(
  sku: SKU,
  viewId: string,
  size: string,
  baseSize: string,
  areas: PrintArea[],
): SKU {
  const v = findView(sku, viewId);
  if (!v) return sku;
  if (size === baseSize) return updateView(sku, viewId, { print_areas: areas });
  return updateView(sku, viewId, {
    size_print_areas: { ...v.size_print_areas, [size]: areas },
  });
}

/**
 * Переопределить геометрию зоны (polygon_mm) для размера — copy-on-write:
 * первое изменение копирует все зоны из базовых в size_print_areas[size].
 * Состав зон (id/имя/метод) остаётся общим — двигается только прямоугольник.
 */
export function updateSizeZoneRect(
  sku: SKU,
  viewId: string,
  size: string,
  baseSize: string,
  areaId: string,
  rect: { x: number; y: number; w: number; h: number },
): SKU {
  const v = findView(sku, viewId);
  if (!v) return sku;
  const cur = effZones(v, size, baseSize);
  const next = cur.map((a) =>
    a.id === areaId
      ? { ...a, polygon_mm: rectZone(a.id, a.name, rect.x, rect.y, rect.w, rect.h).polygon_mm }
      : a,
  );
  return setSizeZones(sku, viewId, size, baseSize, next);
}

function dropKey<T>(
  rec: Record<string, T> | undefined,
  key: string,
): Record<string, T> | undefined {
  if (!rec || !(key in rec)) return rec;
  const next = { ...rec };
  delete next[key];
  return Object.keys(next).length ? next : undefined;
}

/** Сбросить per-size якоря размера (вернуть к базовым). */
export function clearSizeAnchors(sku: SKU, viewId: string, size: string): SKU {
  const v = findView(sku, viewId);
  if (!v) return sku;
  return updateView(sku, viewId, { size_anchors: dropKey(v.size_anchors, size) });
}

/** Сбросить per-size зоны размера. */
export function clearSizeZones(sku: SKU, viewId: string, size: string): SKU {
  const v = findView(sku, viewId);
  if (!v) return sku;
  return updateView(sku, viewId, {
    size_print_areas: dropKey(v.size_print_areas, size),
  });
}

/** Сбросить per-size флэт размера. */
export function clearSizeFlat(sku: SKU, viewId: string, size: string): SKU {
  const v = findView(sku, viewId);
  if (!v) return sku;
  return updateView(sku, viewId, { size_flats: dropKey(v.size_flats, size) });
}

/** Сбросить per-size override вида (вернуть к базовым на этом размере). */
export function clearSizeOverride(sku: SKU, viewId: string, size: string): SKU {
  const v = findView(sku, viewId);
  if (!v) return sku;
  const sa = { ...v.size_anchors };
  delete sa[size];
  const sz = { ...v.size_print_areas };
  delete sz[size];
  const sf = { ...v.size_flats };
  delete sf[size];
  return updateView(sku, viewId, {
    size_anchors: Object.keys(sa).length ? sa : undefined,
    size_print_areas: Object.keys(sz).length ? sz : undefined,
    size_flats: Object.keys(sf).length ? sf : undefined,
  });
}

/** Пустой SKU-каркас (для «создать вручную»). */
export function emptySku(id: string, name: string, type: GarmentType): SKU {
  const base: BaseSize = "M";
  return {
    id,
    name,
    type,
    product_kind: "finished",
    base_size: base,
    sizes: [base],
    views: [emptyView(id, "front")],
  };
}
