---
name: merch-geometry
description: Метрическая логика размещения нанесений на изделии. Используй всегда при расчёте позиций, отступов, обвязки и grading. Все величины в мм. Якоря привязаны к изделию (горловина, центр, низ рукава), не к холсту.
---

# Merch geometry

Единицы — миллиметры. Координаты вида совпадают с его SVG (scale_mm_per_unit связывает unit↔мм).

## Якоря
- front/back: neckline_point{x,y} (нижняя точка выреза по центру), center_axis_x (ось центра).
- sleeve: sleeve_bottom_y (нижний край), sleeve_center_x.

## Отступы (bbox макета {x,y,w,h}, top-left)
- front/back: vertical_from_neckline = bbox.y − neckline_point.y;
  horizontal_from_center = (bbox.x + bbox.w/2) − center_axis_x.
- sleeve: vertical_from_bottom = sleeve_bottom_y − (bbox.y + bbox.h);
  horizontal_from_center = (bbox.x + bbox.w/2) − sleeve_center_x.

## Полная обвязка (зона {zx,zy,zw,zh})
left=bbox.x−zx; right=(zx+zw)−(bbox.x+bbox.w); top=bbox.y−zy; bottom=(zy+zh)−(bbox.y+bbox.h);
print_size = bbox.w × bbox.h.

## Grading — КОНСТАНТА от горловины
При смене размера сохраняй vertical_from_neckline, horizontal_from_center и размер печати.
Новое положение: bbox.y' = neckline_point'.y + vertical_from_neckline (sleeve — от sleeve_bottom_y').
Размер печати с ростовкой не меняется. Требует per-size якорей (SizeGrade).

## Предупреждение за зону
Если любой из left/right/top/bottom < 0 → out_of_zone=true. Строгий режим — против safe_inset_mm.
Не блокировать сохранение, только предупреждать.

## Правила
- Никогда не считай в пикселях для бизнес-логики — только мм. px = mm * pxPerMM лишь для отрисовки.
- Поворот: обвязку считай по axis-aligned bbox повёрнутого макета.
