// Доменная модель PINHEAD — Merch Preview Tool (BUILD.md §3).
// Все метрические величины — в миллиметрах (мм).

export type GarmentType = "tshirt" | "sweatshirt" | "hoodie" | "shopper";
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

/** Якоря вида, привязанные к изделию (не к холсту). Все в единицах SVG вида. */
export interface ViewAnchors {
  /** Нижняя точка горловины по центру (front/back). */
  neckline_point?: { x: number; y: number };
  /** Ось центра изделия по горизонтали. */
  center_axis_x?: number;
  /** Нижний край рукава (sleeve). */
  sleeve_bottom_y?: number;
  /** Центр рукава по горизонтали (sleeve). */
  sleeve_center_x?: number;
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
  /** Зеркалирование по горизонтали/вертикали. */
  flip_h?: boolean;
  flip_v?: boolean;
  /** Скрыть из рендера / заблокировать для редактирования. */
  hidden?: boolean;
  locked?: boolean;
  /** Пользовательское имя слоя. */
  name?: string;
}

export interface Project {
  id: string;
  sku_id: string;
  client: string;
  order_ref: string;
  status: ProjectStatus;
  placements: Placement[];
}
