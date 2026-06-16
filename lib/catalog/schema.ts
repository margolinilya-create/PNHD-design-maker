// Zod-схема каталога (BUILD.md §3). Источник правды метрики — skus.json.
import { z } from "zod";

export const viewKindSchema = z.enum([
  "front",
  "back",
  "sleeve_left",
  "sleeve_right",
  "label_neck_inner",
  "label_neck_outer",
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
  size_flats: z.record(z.string(), z.string()).optional(),
  size_anchors: z.record(z.string(), anchorsSchema).optional(),
  print_areas: z.array(printAreaSchema).min(1),
  size_print_areas: z
    .record(z.string(), z.array(printAreaSchema).min(1))
    .optional(),
});

export const skuSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["tshirt", "sweatshirt", "hoodie", "shopper"]),
    base_size: z.enum(["M", "L"]),
    sizes: z.array(z.string()).min(1),
    views: z.array(viewSchema).min(1),
  })
  .superRefine((sku, ctx) => {
    const sizeSet = new Set(sku.sizes);

    // base_size обязан входить в sizes.
    if (!sizeSet.has(sku.base_size)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["base_size"],
        message: `base_size "${sku.base_size}" отсутствует в sizes`,
      });
    }

    sku.views.forEach((view, vi) => {
      // Якоря согласуются с kind вида.
      const isSleeve = view.kind === "sleeve_left" || view.kind === "sleeve_right";
      const isLabel = view.kind.startsWith("label");
      const checkAnchors = (
        a: z.infer<typeof anchorsSchema>,
        path: (string | number)[],
      ) => {
        if (isLabel) return; // этикетка — панельный вид, якоря не обязательны
        if (isSleeve) {
          if (a.sleeve_bottom_y === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "sleeve_bottom_y"],
              message: "для рукава обязателен sleeve_bottom_y",
            });
          }
          if (a.sleeve_center_x === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "sleeve_center_x"],
              message: "для рукава обязателен sleeve_center_x",
            });
          }
        } else {
          // front / back
          if (a.neckline_point === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "neckline_point"],
              message: "для front/back обязателен neckline_point",
            });
          }
          if (a.center_axis_x === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, "center_axis_x"],
              message: "для front/back обязателен center_axis_x",
            });
          }
        }
      };

      // Базовые якоря вида.
      checkAnchors(view.anchors, ["views", vi, "anchors"]);

      // Per-size якоря: ключи ⊆ sizes и согласованность с kind.
      if (view.size_anchors) {
        for (const [size, a] of Object.entries(view.size_anchors)) {
          if (!sizeSet.has(size)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["views", vi, "size_anchors", size],
              message: `размер "${size}" отсутствует в sizes`,
            });
          }
          checkAnchors(a, ["views", vi, "size_anchors", size]);
        }
      }

      // Печатные зоны: невырожденность полигона и адекватность safe_inset.
      const checkArea = (
        area: z.infer<typeof printAreaSchema>,
        path: (string | number)[],
      ) => {
        const xs = area.polygon_mm.map((p) => p[0]);
        const ys = area.polygon_mm.map((p) => p[1]);
        const w = Math.max(...xs) - Math.min(...xs);
        const h = Math.max(...ys) - Math.min(...ys);
        if (!(w > 0) || !(h > 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "polygon_mm"],
            message: "AABB полигона вырожден (ширина/высота должны быть > 0)",
          });
        }
        if (!(area.safe_inset_mm * 2 < Math.min(w, h))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "safe_inset_mm"],
            message: "safe_inset_mm * 2 должен быть меньше min(ширина, высота) зоны",
          });
        }
      };
      view.print_areas.forEach((area, ai) =>
        checkArea(area, ["views", vi, "print_areas", ai]),
      );

      // Per-size зоны: ключи ⊆ sizes и валидность каждой зоны.
      if (view.size_print_areas) {
        for (const [size, areas] of Object.entries(view.size_print_areas)) {
          if (!sizeSet.has(size)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["views", vi, "size_print_areas", size],
              message: `размер "${size}" отсутствует в sizes`,
            });
          }
          areas.forEach((area, ai) =>
            checkArea(area, ["views", vi, "size_print_areas", size, ai]),
          );
        }
      }
    });
  });

export const catalogSchema = z.object({
  skus: z.array(skuSchema).min(1),
});

export type Catalog = z.infer<typeof catalogSchema>;
