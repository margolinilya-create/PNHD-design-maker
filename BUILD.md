# PINHEAD — Merch Preview Tool · Мастер-документ MVP

Единый источник правды для сборки инструмента превью/технических рисунков мерча.
Содержит: зафиксированные решения, полную спецификацию, тестовые данные, Claude Code скилы и агентов, зависимости, структуру проекта и пошаговый план сборки MVP.

> Положи этот файл в корень репозитория как `BUILD.md`. Скилы и агентов из разделов 6–7 разложи по `.claude/`. Сборку веди по разделу 10.

---

## 0. Как пользоваться

1. Раздел 1 — что мы решили (быстрый справочник).
2. Разделы 2–4 — спецификация и модель данных (что строим).
3. Раздел 5 — тестовые данные (на чём запускаем сразу).
4. Разделы 6–7 — установить скилы и агентов в Claude Code.
5. Разделы 8–9 — зависимости и структура.
6. Раздел 10 — собственно сборка, фаза за фазой. Каждую фазу гонишь через скил `bulletproof`.

---

## 1. Зафиксированные решения

| # | Решение | Значение |
|---|---------|----------|
| 1 | Точка отсчёта нанесения | Горловина (верх) + центр переда |
| 2 | Отсчёт для рукава | От нижнего края рукава вверх |
| 3 | Размеры на чертеже | Полная обвязка (верт. от горловины + гор. от центра + 4 отступа до зоны) |
| 4 | Поведение по размерам | Отступ от горловины — **константа** на всех ростовках |
| 5 | Базовый размер | Один эталон (M/L), остальные пересчитываются |
| 6 | Форматы загрузки | Вектор (SVG) + растр (PNG); контроль DPI — позже |
| 7 | Единицы / контроль | **мм**; предупреждение при выходе за зону (не блок); реальный размер печати Ш×В |
| 8 | Нанесений в проекте | Несколько одновременно (грудь + спина + рукав) |
| 9 | Выход | Один PDF (превью + размеры), для клиента и цеха |
| 10 | Стек / рендер | Next.js + React + TS; редактор `react-konva`; экспорт — векторный PDF |
| 11 | Лекала | Готовые векторные флэты в масштабе (на старт — тестовые, см. §5) |

---

## 2. Цель и сценарий

Внутренний self-hosted инструмент оператора производства. Делает **технический рисунок-раскладку** (метрическая точность + размерные линии), а не маркетинговый мокап. 3D не нужен.

Сценарий:
1. Выбрать SKU.
2. Загрузить макет (SVG/PNG).
3. Выбрать место(а) нанесения (грудь / спина / рукав — зависит от SKU).
4. Превью в реальном масштабе; двигать, масштабировать, вращать макет в печатной зоне.
5. Сохранить → единый PDF с полной обвязкой для согласования и производства.

Референс по логике (не визуалу): Printful Design Maker — печатные зоны, safe-zone, контроль размера.

---

## 3. Модель данных

```
SKU            id, name, type(tshirt|sweatshirt|hoodie|shopper), base_size(M|L), sizes[], views[]
View           id, kind(front|back|sleeve_left|sleeve_right), flat_svg, scale_mm_per_unit,
               anchors{ neckline_point{x,y}, center_axis_x, sleeve_bottom_y?, sleeve_center_x? },
               print_areas[]
PrintArea      id, name, polygon_mm[][], safe_inset_mm
SizeGrade      sku_id, size, view_kind, geometry_delta     # регрейдинг (после MVP)
Project        id, sku_id, client, order_ref, status(draft|approved), placements[]
Placement      id, print_area_id, asset_id, x_mm, y_mm, width_mm, height_mm, rotation_deg
Asset          id, type(svg|png), source_file, intrinsic_size_mm, dpi?
```

---

## 4. Система координат и логика  ⚠️ ядро

Координаты каждого вида — в мм; начало и оси привязаны к **якорям** изделия (не к холсту). `scale_mm_per_unit` связывает единицы SVG с мм.

**Перед / спина:**
- Вертикаль: от `neckline_point.y` вниз до **верха** bbox макета → `vertical_from_neckline = bbox.y − neckline_point.y`.
- Горизонталь: от `center_axis_x` до центра макета → `horizontal_from_center = (bbox.x + bbox.w/2) − center_axis_x` (0 = по центру).

**Рукав:**
- Вертикаль: от `sleeve_bottom_y` вверх до **низа** bbox → `vertical_from_bottom = sleeve_bottom_y − (bbox.y + bbox.h)`.
- Горизонталь: от `sleeve_center_x` (настраиваемо).

**Полная обвязка** (зона bbox `{zx,zy,zw,zh}`):
- left = `bbox.x − zx`; right = `(zx+zw) − (bbox.x+bbox.w)`; top = `bbox.y − zy`; bottom = `(zy+zh) − (bbox.y+bbox.h)`.
- размер печати = `bbox.w × bbox.h` мм.

**Grading (константа от горловины):** при смене размера сохраняем `vertical_from_neckline`, `horizontal_from_center` и размер печати; новое положение = `bbox.y' = neckline_point'.y + vertical_from_neckline` (для рукава — от `sleeve_bottom_y'`). Требует per-size якорей (`SizeGrade`) — в MVP считаем на эталоне, multi-size рендер включаем в Фазе 4 с заглушкой регрейдинга.

**Предупреждение за зону:** любой из отступов (left/right/top/bottom) < 0 → подсветка + текст. Строже — проверять против safe-zone (`safe_inset_mm`). Не блокирует сохранение.

---

## 5. Тестовые данные (seed)

Готовый набор уже создан (масштаб **1 unit = 1 мм**), кладётся в `public/seed/`:

```
public/seed/
  skus.json                 # каталог: SKU tshirt-classic, виды front/back/sleeve
  flats/tshirt-L-front.svg  # перед: якоря neckline_point(300,92), center_axis_x=300; зона груди 300×400
  flats/tshirt-L-back.svg   # спина: neckline_point(300,58); зона спины 320×420
  flats/tshirt-L-sleeve.svg # рукав: sleeve_bottom_y=180; зона рукава 120×90
```

Метрика (якоря, зоны) — в `skus.json`; SVG отвечает за визуал, в нём продублированы элементы с `id` (`garment`, `print-area-*`, `center-axis`, `neckline-point`). Один SKU с тремя видами сразу проверяет мультинанесение. Замену на реальные лекала см. в `seed/README.md`.

Свободные флэты «из интернета» (Public Domain, OpenClipart), если нужны другие силуэты: freesvg.org/male-t-shirt-template-vector-drawing, freesvg.org/sweatshirt-template. Они не в масштабе и без якорей — требуют калибровки.

---

## 6. Claude Code — скилы

Разложить по `.claude/skills/<name>/SKILL.md`. Эти четыре кодируют доменную логику, чтобы агенты применяли её одинаково. Плюс используем уже имеющиеся: **`bulletproof`** (рабочий цикл на каждой фазе) и **`frontend-design`** (полировка UI редактора).

### 6.1 `.claude/skills/merch-geometry/SKILL.md`

```markdown
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
```

### 6.2 `.claude/skills/flat-svg-convention/SKILL.md`

```markdown
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
```

### 6.3 `.claude/skills/konva-mm-canvas/SKILL.md`

```markdown
---
name: konva-mm-canvas
description: Конвенции редактора холста на react-konva с метрикой в мм. Используй при работе с canvas, Stage, слоями, Transformer, перетаскиванием и масштабированием.
---

# Konva mm canvas

- Единый pxPerMM на Stage; экранный zoom — отдельный множитель, не путать с метрикой.
- Бизнес-координаты храним в мм; в px переводим только на рендере (px = mm * pxPerMM * zoom).
- Слои: (1) флэт изделия, (2) печатная зона + safe-zone, (3) нанесения (Image), (4) обвязка/оверлеи.
- Макет — Konva.Image (для SVG предварительно растеризовать в нужном разрешении или через canvg/Path); Transformer для масштаба/поворота, keepRatio по умолчанию.
- На каждом изменении пересчитывай мм-bbox и зови merch-geometry для отступов и проверки зоны.
- UI/визуальную полировку делай по скилу frontend-design.
```

### 6.4 `.claude/skills/vector-pdf-export/SKILL.md`

```markdown
---
name: vector-pdf-export
description: Сборка итогового PDF тех-рисунка с векторной размерной обвязкой. Используй при экспорте/сохранении проекта в PDF.
---

# Vector PDF export

- Композируй итоговую сцену как ЕДИНЫЙ SVG: флэт + размещённые макеты + размерные линии обвязки + подписи (мм, Ш×В) + рамка проекта (SKU, размер-эталон, клиент, заказ, дата).
- Конвертируй SVG → PDF через jsPDF + svg2pdf.js, чтобы линии/текст остались ВЕКТОРНЫМИ. Растровые макеты (PNG) встроятся как растр — это нормально, обвязка и флэт векторные.
- Масштаб PDF 1:1 в мм (страница в мм; проверяемо линейкой).
- Полная обвязка обязательна: вертикаль от горловины, горизонталь от центра, 4 отступа до краёв зоны, размер печати.
- Один PDF на проект (все нанесения/виды). Размерные линии со стрелками и числовыми выносками.
```

---

## 7. Claude Code — база агентов

Разложить по `.claude/agents/<name>.md`. Узкие роли, чтобы держать контекст и качество. Запускай через основной чат Claude Code: «delegate to <agent>…».

### 7.1 `.claude/agents/architect.md`

```markdown
---
name: architect
description: Хранитель спецификации и модели данных. Планирует фазы, ревьюит решения на соответствие BUILD.md. Зови в начале фазы и при архитектурных развилках.
tools: Read, Grep, Glob, Edit
---
Ты архитектор проекта merch-preview. Источник правды — BUILD.md (разделы 2–4).
Следи, чтобы код соответствовал модели данных и логике координат. Перед реализацией фазы выдай короткий план: файлы, контракты типов, точки расширения. Не допускай дрейфа от BUILD.md без явного решения. Бизнес-логику считай в мм (скил merch-geometry).
```

### 7.2 `.claude/agents/geometry-engineer.md`

```markdown
---
name: geometry-engineer
description: Координатная математика — отступы, обвязка, grading, проверка зоны. Зови для lib/geometry/*. Всегда применяй скил merch-geometry.
tools: Read, Edit, Bash
---
Реализуешь чистые функции на TS в мм: расчёт отступов (front/back/sleeve), полной обвязки, константного grading от горловины, флага out_of_zone. Без зависимостей от UI. Покрывай юнит-тестами (vitest): эталонные кейсы из BUILD.md §4. Никаких пикселей в логике.
```

### 7.3 `.claude/agents/canvas-engineer.md`

```markdown
---
name: canvas-engineer
description: Редактор холста на react-konva — рендер флэта, зоны, нанесения, Transformer, drag/scale/rotate, предупреждение за зону. Скилы konva-mm-canvas + frontend-design.
tools: Read, Edit, Bash
---
Строишь интерактивный редактор. Метрика в мм через pxPerMM, экранный zoom отдельно. На каждое изменение вызываешь geometry-функции и обновляешь readouts (отступы, Ш×В). Поддержка нескольких нанесений и переключения видов. UI аккуратный по frontend-design.
```

### 7.4 `.claude/agents/pdf-exporter.md`

```markdown
---
name: pdf-exporter
description: Экспорт проекта в единый векторный PDF с полной обвязкой. Скил vector-pdf-export. Зови для lib/export/*.
tools: Read, Edit, Bash
---
Композируешь сцену в SVG (флэт + макеты + размерные линии обвязки + подписи + рамка проекта), конвертируешь в PDF (jsPDF + svg2pdf.js) векторно, масштаб 1:1 в мм. Один PDF на проект. Проверяешь критерии приёмки BUILD.md §10/§Фаза 6.
```

### 7.5 `.claude/agents/catalog-engineer.md`

```markdown
---
name: catalog-engineer
description: Каталог SKU, загрузка/валидация seed (skus.json), стор проекта (zustand), загрузка макетов (SVG/PNG, intrinsic_size_mm, dpi). Зови для lib/catalog/*, lib/state/*.
tools: Read, Edit, Bash
---
Грузишь и валидируешь skus.json (zod) по модели BUILD.md §3. SKU picker, выбор видов и зон. Стор проекта с массивом нанесений. Загрузка ассетов с физическим размером в мм; поле dpi заполняешь, но в MVP не блокируешь.
```

### 7.6 `.claude/agents/qa-reviewer.md`

```markdown
---
name: qa-reviewer
description: Проверка соответствия критериям приёмки и логике. Зови в конце каждой фазы. Не пишет фичи — только верификация и баг-репорт.
tools: Read, Grep, Glob, Bash
---
Проверяешь фазу против критериев приёмки BUILD.md. Главное: отступ от горловины — константа на всех размерах (числовая проверка); размер печати на PDF соответствует реальному (1:1); полная обвязка присутствует и читаема; предупреждение за зону срабатывает; мультинанесение в один PDF. Выдаёшь список несоответствий, не правишь сам.
```

---

## 8. Зависимости

```bash
# каркас (если не используешь vibe template)
npx create-next-app@latest merch-preview --ts --tailwind --app --eslint

cd merch-preview
# холст
npm i konva react-konva
# экспорт PDF (вектор)
npm i jspdf svg2pdf.js
# состояние и валидация
npm i zustand zod
# (опц.) растеризация SVG-макетов на канву
npm i canvg
# тесты геометрии
npm i -D vitest
```

---

## 9. Структура проекта

```
merch-preview/
  app/
    page.tsx                       # выбор SKU → редактор
    editor/page.tsx                # экран редактора
  components/
    catalog/SkuPicker.tsx
    editor/Stage.tsx               # Konva Stage, pxPerMM
    editor/GarmentFlat.tsx         # рендер флэта вида
    editor/PrintArea.tsx           # зона + safe-zone
    editor/PlacementLayer.tsx      # нанесения + Transformer
    editor/Dimensions.tsx          # обвязка/readouts
    editor/ViewTabs.tsx            # перед/спина/рукав
  lib/
    geometry/coords.ts             # mm<->px, отступы
    geometry/dimension.ts          # полная обвязка
    geometry/grading.ts            # константа от горловины
    geometry/zone.ts               # out_of_zone
    catalog/loadCatalog.ts         # parse+zod skus.json
    state/projectStore.ts          # zustand
    export/buildSceneSvg.ts        # композиция SVG
    export/exportPdf.ts            # svg2pdf → PDF
  types/index.ts                   # SKU/View/Placement/...
  public/seed/                     # ← сюда положить созданный seed/
  .claude/
    skills/{merch-geometry,flat-svg-convention,konva-mm-canvas,vector-pdf-export}/SKILL.md
    agents/{architect,geometry-engineer,canvas-engineer,pdf-exporter,catalog-engineer,qa-reviewer}.md
  BUILD.md                         # этот файл
```

---

## 10. Пошаговый план MVP

Каждую фазу веди через скил **`bulletproof`** (research → план → реализация → проверка). В конце фазы — агент `qa-reviewer`. Двигайся только при зелёных критериях.

### Фаза 0 — Каркас (≈30 мин)
- `npx create-next-app` (или твой vibe template) + установить зависимости (§8).
- Скопировать созданный `seed/` в `public/seed/`.
- Разложить скилы и агентов из §6–7 по `.claude/`.
- Завести `types/index.ts` по модели §3.
- **Приёмка:** проект запускается, `public/seed/skus.json` доступен, `.claude/` на месте.
- Claude Code: «Инициализируй каркас по BUILD.md §8–9, перенеси seed, создай типы. Используй bulletproof.»

### Фаза 1 — Каталог + рендер флэта (agent: catalog-engineer, canvas-engineer)
- Загрузить и провалидировать `skus.json` (zod). `SkuPicker`.
- Konva Stage с `pxPerMM`, сетка 50 мм, рендер флэта выбранного вида, переключение видов.
- **Приёмка:** флэт рисуется в масштабе, виды переключаются, размеры на экране соответствуют мм.
- Claude Code: «Реализуй Фазу 1 по BUILD.md. Делегируй catalog-engineer и canvas-engineer.»

### Фаза 2 — Зоны + загрузка макета (agent: canvas-engineer, catalog-engineer)
- Отрисовать `print-area` + safe-zone из `polygon_mm`.
- Загрузка SVG/PNG, помещение в зону, сохранить `intrinsic_size_mm`.
- **Приёмка:** зона видна, макет загружается и появляется в зоне с реальным размером.

### Фаза 3 — Редактор: drag/scale/rotate + предупреждение (agent: canvas-engineer, geometry-engineer)
- Konva Transformer (keepRatio), перевод в мм, readout отступов и Ш×В.
- Флаг `out_of_zone` (скил merch-geometry) → подсветка + текст.
- **Приёмка:** макет двигается/масштабируется/вращается; при выходе за зону — предупреждение; Ш×В корректны.

### Фаза 4 — Координаты + grading (agent: geometry-engineer)
- `lib/geometry/*`: отступы front/back/sleeve, полная обвязка, **константный grading от горловины**, селектор размера пересчитывает положение.
- Юнит-тесты (vitest) на эталонных кейсах §4. (Per-size якоря — заглушка `SizeGrade`, помечена TODO.)
- **Приёмка:** при смене S↔XXL отступ от горловины численно постоянен; тесты зелёные.

### Фаза 5 — Мультинанесение (agent: catalog-engineer, canvas-engineer)
- Стор проекта (zustand): массив нанесений по разным видам; список и переключение.
- **Приёмка:** грудь + спина + рукав одновременно в одном проекте.

### Фаза 6 — Экспорт PDF с обвязкой (agent: pdf-exporter)
- `buildSceneSvg` → `exportPdf` (jsPDF + svg2pdf.js), масштаб 1:1 мм, полная обвязка, рамка проекта.
- **Приёмка (критерии §12 SPEC):** один PDF на проект; размер печати 1:1; обвязка читаема; вертикаль от горловины + горизонталь от центра + 4 отступа.

### Фаза 7 — Статусы/сохранение (agent: catalog-engineer)
- Сохранение проекта, статус draft → approved.
- **Приёмка:** проект сохраняется и переоткрывается; статус меняется.

---

## 11. Чек-лист готовности MVP

- [ ] Оператор за ≤5 шагов получает корректный PDF для выбранного SKU.
- [ ] Отступ от горловины — константа на всех размерах (числовая проверка).
- [ ] Размер печати на PDF = реальному (линейка 1:1).
- [ ] Полная обвязка: вертикаль от горловины, горизонталь от центра, 4 отступа до зоны, Ш×В.
- [ ] Выход за зону подсвечивается предупреждением.
- [ ] Несколько нанесений на изделии → один PDF.
- [ ] Seed заменяем на реальные лекала по `seed/README.md` без изменения кода.

---

## 12. Что НЕ в MVP (точки расширения)

3D-визуализация · жёсткий DPI-контроль и блокировки (только задел в данных) · ручной регрейдинг отступов на размер (per-size `SizeGrade`) · интеграции с CRM/учётом.
