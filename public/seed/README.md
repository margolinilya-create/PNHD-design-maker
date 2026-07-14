# Seed-данные (заводской каталог)

Каталог собран из визуалок заказчика (.ai → SVG, конвейер
`scripts/visuals_batch.py`). Масштаб флэтов: мм = единицы SVG ×
`scale_mm_per_unit` вида.

```
public/seed/
  skus.json   # каталог SKU + метрика (якоря, печатные зоны) — источник правды
  flats/      # SVG-флэты видов (перёд/спина), контракт recolor: <g id="garment">
```

Эталон каталога — `tshirt-freefit` (выверенные зоны). Остальные SKU — с
предварительными зонами/якорями, размеры пока `["M"]` (аксессуары — ONE SIZE).

## Источник правды — `skus.json`

Приложение читает метрику (якоря, `polygon_mm` зон, `safe_inset_mm`) из
`skus.json`. SVG отвечает только за визуал; обязательный контракт перекраски —
группа `<g id="garment" fill="...">` (см. seedFlats.test.ts).

## Добавление нового SKU

1. Прогони визуалку через `scripts/visuals_batch.py` (маппинг страниц в
   `scripts/visuals-batch-config.json`) — SVG лягут в `flats/`.
2. Впиши запись в `skus.json` по образцу `tshirt-freefit`: якоря в мм
   (`neckline_point` + `center_axis_x`; для рукава `sleeve_bottom_y` +
   `sleeve_center_x`; для аксессуара — только ось), зоны `polygon_mm` +
   `safe_inset_mm`, `scale_mm_per_unit`.
3. Контрактные тесты recolor (`lib/catalog/seedFlats.test.ts`) подхватят новые
   файлы автоматически.

Либо размечай через админку (`/admin` → «Создать»), а результат переноси в seed.

См. конвенцию флэтов: `.claude/skills/flat-svg-convention/SKILL.md`.
