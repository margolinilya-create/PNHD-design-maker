// Доменная модель PINHEAD — Merch Preview Tool (BUILD.md §3).
// Все метрические величины — в миллиметрах (мм).

export type GarmentType =
  | "tshirt"
  | "polo"
  | "longsleeve"
  | "sweatshirt"
  | "hoodie"
  | "zip_hoodie"
  | "half_zip"
  | "bomber"
  | "olympic"
  | "pants"
  | "shopper";

/** Русские подписи типов изделий (селекторы админки, карточки каталога). */
export const GARMENT_TYPE_LABELS: Record<GarmentType, string> = {
  tshirt: "футболка",
  polo: "поло",
  longsleeve: "лонгслив",
  sweatshirt: "свитшот",
  hoodie: "худи",
  zip_hoodie: "зип-худи",
  half_zip: "халф-зип",
  bomber: "бомбер",
  olympic: "олимпийка",
  pants: "брюки",
  shopper: "шоппер",
};
/**
 * Категория товара: одежда или аксессуар (шопперы и т.п.). Не хранится в
 * данных — выводится из GarmentType через GARMENT_TYPE_CATEGORY. У аксессуаров
 * нет горловины: neckline_point не требуется схемой и отключён в редакторах.
 */
export type ProductCategory = "clothing" | "accessory";

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  clothing: "Одежда",
  accessory: "Аксессуары",
};

/**
 * Категория каждого типа изделия. Record<GarmentType, …> заставит компилятор
 * дополнить карту при новом типе (zod-enum в lib/catalog/schema.ts — нет,
 * его синхронизировать вручную).
 */
export const GARMENT_TYPE_CATEGORY: Record<GarmentType, ProductCategory> = {
  tshirt: "clothing",
  polo: "clothing",
  longsleeve: "clothing",
  sweatshirt: "clothing",
  hoodie: "clothing",
  zip_hoodie: "clothing",
  half_zip: "clothing",
  bomber: "clothing",
  olympic: "clothing",
  pants: "clothing",
  shopper: "accessory",
};

export const isAccessoryType = (t: GarmentType): boolean =>
  GARMENT_TYPE_CATEGORY[t] === "accessory";

export const skuCategory = (sku: Pick<SKU, "type">): ProductCategory =>
  GARMENT_TYPE_CATEGORY[sku.type];

/**
 * Вид продукта: печать на готовом изделии (визуалка) или на крое до пошива
 * (лекало). Первичное разделение каталога; отсутствие поля = "finished".
 */
export type ProductKind = "finished" | "cut";
export type BaseSize = "M" | "L";
export type ViewKind =
  | "front"
  | "back"
  | "sleeve_left"
  | "sleeve_right"
  | "label_neck_inner"
  | "label_neck_outer";
export type AssetType = "svg" | "png";
export type ProjectStatus = "draft" | "approved";
/** Метод нанесения (профиль подготовки к печати). */
export type PrintMethod = "dtf" | "screenprint" | "embroidery";

/** Именованная вертикальная ось изделия (выточка/рельеф/шов/карман). */
export interface NamedAxis {
  id: string;
  /** Подпись для пресета «Центр: {name}» и оверлея. */
  name: string;
  /** X оси в мм флэта (админ-канвас пишет мм; геометрия читает как мм). */
  x: number;
}

/** Якоря вида, привязанные к изделию (не к холсту). Все координаты в ММ флэта. */
export interface ViewAnchors {
  /** Нижняя точка горловины по центру (front/back). */
  neckline_point?: { x: number; y: number };
  /** Ось центра изделия по горизонтали. */
  center_axis_x?: number;
  /** Нижний край рукава (sleeve). */
  sleeve_bottom_y?: number;
  /** Центр рукава по горизонтали (sleeve). */
  sleeve_center_x?: number;
  /**
   * Доп. вертикальные оси (центровка «по выточкам» и т.п.).
   * ВНИМАНИЕ: per-size override якорей заменяет объект целиком —
   * оси в override нужно повторять (см. anchorsForSize/effAnchors).
   */
  axes?: NamedAxis[];
}

/** Дельта якоря на один шаг размера (мм). */
export interface AnchorDelta {
  dx?: number;
  dy?: number;
}

/**
 * Правило ростовки (grade-rule, S2.3): дельты якорей на ОДИН шаг размера.
 * Разворачивается в per-size якоря (linear ΔX/ΔY × шаг от базового размера).
 * Явные `size_anchors` приоритетнее правила.
 */
export interface GradeRule {
  /** ΔX/ΔY горловины (front/back) на шаг. */
  neckline?: AnchorDelta;
  /** ΔX оси центра на шаг. */
  center_axis_dx?: number;
  /** ΔY нижнего края рукава на шаг. */
  sleeve_bottom_dy?: number;
  /** ΔX центра рукава на шаг. */
  sleeve_center_dx?: number;
}

/** Печатная зона в мм. */
export interface PrintArea {
  id: string;
  name: string;
  /** Полигон зоны в мм: массив точек [x, y]. */
  polygon_mm: [number, number][];
  /** Внутренний отступ safe-zone в мм. */
  safe_inset_mm: number;
  /** Метод печати по умолчанию для зоны (напр. этикетка/грудь — вышивка). */
  default_method?: PrintMethod;
  /**
   * Допустимые методы печати в зоне (напр. карман худи — только DTF).
   * Отсутствие/пустой список = допустимы все методы.
   */
  methods?: PrintMethod[];
  /** Допустимый максимум размера печати (мм) — превышение предупреждается. */
  max_print_mm?: { width: number; height: number };
  /** Допустимый минимум размера печати (мм) — меньше = предупреждение. */
  min_print_mm?: { width: number; height: number };
}

export interface View {
  id: string;
  kind: ViewKind;
  /** Путь к SVG-флэту вида (базовый размер). */
  flat_svg: string;
  /** Per-size флэты (фоллбэк на `flat_svg`). Ключ — размер из SKU.sizes. */
  size_flats?: Record<string, string>;
  /** Коэффициент перевода единиц SVG в мм (1 = 1 unit → 1 мм). */
  scale_mm_per_unit: number;
  anchors: ViewAnchors;
  /**
   * Per-size якоря (регрейдинг). Ключ — размер из SKU.sizes.
   * Если размера нет — берутся базовые `anchors`.
   */
  size_anchors?: Record<string, ViewAnchors>;
  /** Правило ростовки: разворачивается в `size_anchors` при загрузке каталога. */
  grade_rule?: GradeRule;
  print_areas: PrintArea[];
  /** Per-size печатные зоны (фоллбэк на `print_areas`). Ключ — размер из SKU.sizes. */
  size_print_areas?: Record<string, PrintArea[]>;
}

export interface SKU {
  id: string;
  name: string;
  type: GarmentType;
  /** Вид продукта: готовое изделие / крой. Отсутствие = "finished". */
  product_kind?: ProductKind;
  /** Скрыта из клиентского каталога (в админке остаётся видимой). */
  hidden?: boolean;
  base_size: BaseSize;
  sizes: string[];
  views: View[];
}

/** Регрейдинг геометрии под конкретный размер (после MVP — заглушка). */
export interface SizeGrade {
  sku_id: string;
  size: string;
  view_kind: ViewKind;
  /** Дельта геометрии относительно базового размера. */
  geometry_delta: ViewAnchors;
}

export interface Asset {
  id: string;
  type: AssetType;
  /** Имя исходного файла. */
  source_file: string;
  /** Данные для рендера (data URL). */
  data_url?: string;
  /** Физический размер ассета в мм. */
  intrinsic_size_mm: { width: number; height: number };
  /** Пиксельные размеры растрового исходника (для расчёта DPI печати). */
  px_width?: number;
  px_height?: number;
  dpi?: number;
  /** true — физический размер не выведен из файла, взят дефолт (оценка). */
  size_estimated?: boolean;
}

/** Размещение макета в печатной зоне (всё в мм / градусах). */
export interface Placement {
  id: string;
  print_area_id: string;
  asset_id: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  rotation_deg: number;
  /** Метод печати нанесения (фоллбэк — default_method зоны, затем DTF). */
  method?: PrintMethod;
  /** Допуск ± на ключевые меры обвязки (мм). Target = вычисленное значение. */
  tolerance_mm?: number;
  /** How-To-Measure: краткая заметка «как мерить» для цеха. */
  htm?: string;
  /** Коды Pantone (spot-цвета) для шелкографии/вышивки. */
  pantone?: string[];
  /** Зеркалирование по горизонтали/вертикали. */
  flip_h?: boolean;
  flip_v?: boolean;
  /** Скрыть из рендера / заблокировать для редактирования. */
  hidden?: boolean;
  locked?: boolean;
  /** Пользовательское имя слоя. */
  name?: string;
}

/** Комментарий согласования (P1 #24). Роль — кто оставил. */
export interface ProjectComment {
  id: string;
  role: "client" | "shop";
  text: string;
  ts: number;
}

export interface Project {
  id: string;
  sku_id: string;
  client: string;
  order_ref: string;
  status: ProjectStatus;
  placements: Placement[];
  comments?: ProjectComment[];
}
