# Seed-данные (тестовые лекала)

Набор для запуска MVP «из коробки». Масштаб **1 unit = 1 мм**.

```
public/seed/
  skus.json                 # каталог SKU + метрика (якоря, печатные зоны)
  flats/tshirt-L-front.svg  # перед:  neckline_point(300,92), center_axis_x=300; зона груди 300×400
  flats/tshirt-L-back.svg   # спина:  neckline_point(300,58), center_axis_x=300; зона спины 320×420
  flats/tshirt-L-sleeve.svg # рукав:  sleeve_bottom_y=180, sleeve_center_x=120; зона рукава 120×90
```

## Источник правды — `skus.json`

Приложение читает метрику (якоря, `polygon_mm` зон, `safe_inset_mm`) из `skus.json`.
SVG отвечает только за визуал и для наглядности дублирует элементы с `id`:
`garment`, `print-area-<name>`, `center-axis`, `neckline-point` / `sleeve-bottom`.

## Замена на реальные лекала (без правок кода)

1. Экспортируй вид изделия в SVG **в масштабе** (1 unit = 1 мм, либо задай
   `scale_mm_per_unit` в записи View).
2. Определи якоря в мм: `neckline_point` + `center_axis_x` (перед/спина) или
   `sleeve_bottom_y` + `sleeve_center_x` (рукав).
3. Опиши печатные зоны полигонами `polygon_mm` и `safe_inset_mm`.
4. Впиши запись в `skus.json` по образцу `tshirt-classic`, положи SVG в `flats/`.

См. конвенцию флэтов: `.claude/skills/flat-svg-convention/SKILL.md`.

## Свободные силуэты (не в масштабе, требуют калибровки)

- freesvg.org/male-t-shirt-template-vector-drawing
- freesvg.org/sweatshirt-template
