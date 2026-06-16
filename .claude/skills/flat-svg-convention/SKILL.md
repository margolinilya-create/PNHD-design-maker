---
name: flat-svg-convention
description: Конвенция векторных флэтов изделий. Используй при создании/парсинге флэтов и при добавлении SKU в каталог. Флэт в реальном масштабе, с якорями и печатными зонами.
---

# Flat SVG convention

- viewBox в мм, scale_mm_per_unit = 1 (1 unit = 1 мм). Если лекало в других единицах — задай коэффициент в View.
- Обязательные элементы с id: `garment` (силуэт), `print-area-<name>` (зоны), `center-axis`, `neckline-point` или `sleeve-bottom`.
- Метрика (якоря, polygon_mm зон, safe_inset_mm) дублируется в skus.json — приложение читает её оттуда; SVG только визуал.
- Зоны: fill-opacity для подложки (НЕ 8-значный hex — несовместим с частью рендеров), dashed stroke.
- Добавление SKU: экспортируй вид в SVG в масштабе → определи якоря в мм → опиши зоны полигонами → впиши запись в skus.json по образцу tshirt-classic.
