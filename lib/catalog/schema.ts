// Zod-схема каталога (BUILD.md §3). Источник правды метрики — skus.json.
import { z } from "zod";

export const viewKindSchema = z.enum([
  "front",
  "back",
  "sleeve_left",
  "sleeve_right",
]);

export const printAreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  polygon_mm: z.array(z.tuple([z.number(), z.number()])).min(3),
  safe_inset_mm: z.number().nonnegative(),
});

export const anchorsSchema = z.object({
  neckline_point: z.object({ x: z.number(), y: z.number() }).optional(),
  center_axis_x: z.number().optional(),
  sleeve_bottom_y: z.number().optional(),
  sleeve_center_x: z.number().optional(),
});

export const viewSchema = z.object({
  id: z.string(),
  kind: viewKindSchema,
  flat_svg: z.string(),
  scale_mm_per_unit: z.number().positive(),
  anchors: anchorsSchema,
  size_anchors: z.record(z.string(), anchorsSchema).optional(),
  print_areas: z.array(printAreaSchema).min(1),
});

export const skuSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["tshirt", "sweatshirt", "hoodie", "shopper"]),
  base_size: z.enum(["M", "L"]),
  sizes: z.array(z.string()).min(1),
  views: z.array(viewSchema).min(1),
});

export const catalogSchema = z.object({
  skus: z.array(skuSchema).min(1),
});

export type Catalog = z.infer<typeof catalogSchema>;
