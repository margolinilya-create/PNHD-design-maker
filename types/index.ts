// Доменная модель PINHEAD — Merch Preview Tool (BUILD.md §3).
// Все метрические величины — в миллиметрах (мм).

export type GarmentType = "tshirt" | "sweatshirt" | "hoodie" | "shopper";
export type BaseSize = "M" | "L";
export type ViewKind = "front" | "back" | "sleeve_left" | "sleeve_right";
export type AssetType = "svg" | "png";
export type ProjectStatus = "draft" | "approved";

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

/** Печатная зона в мм. */
export interface PrintArea {
  id: string;
  name: string;
  /** Полигон зоны в мм: массив точек [x, y]. */
  polygon_mm: [number, number][];
  /** Внутренний отступ safe-zone в мм. */
  safe_inset_mm: number;
}

export interface View {
  id: string;
  kind: ViewKind;
  /** Путь к SVG-флэту вида (в public/). */
  flat_svg: string;
  /** Коэффициент перевода единиц SVG в мм (1 = 1 unit → 1 мм). */
  scale_mm_per_unit: number;
  anchors: ViewAnchors;
  print_areas: PrintArea[];
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
  dpi?: number;
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
}

export interface Project {
  id: string;
  sku_id: string;
  client: string;
  order_ref: string;
  status: ProjectStatus;
  placements: Placement[];
}
