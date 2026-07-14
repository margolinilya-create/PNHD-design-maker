# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Что это

PINHEAD — внутренний инструмент тех-рисунков мерча: раскладка нанесений на изделие в реальном масштабе (мм), проверка ростовки и печатных зон, экспорт векторного PDF 1:1. Прод: https://pnhd-design-maker.vercel.app. Текущее состояние, решения и бэклог — в **MEMORY.md** (читай его вторым; обновляй после значимых изменений).

## Команды

```bash
npm run dev            # дев-сервер :3000
npm run typecheck      # tsc --noEmit
npm run lint           # next lint
npm run test           # vitest run (все)
npx vitest run lib/geometry/geometry.test.ts        # один файл
npx vitest run -t "viewHasZone"                     # по имени теста
npm run build          # прод-сборка
```

Гейт перед коммитом: `typecheck && lint && test && build` — всё должно быть зелёным.

Питон-конвертеры (визуалка .ai → SVG-флэты): `scripts/visuals_batch.py` + `scripts/visuals-batch-config.json` (PyMuPDF; артборд режется на виды методом связных компонент, объекты вне MediaBox отбрасываются — Illustrator сохраняет мусор за холстом).

## Архитектура (big picture)

**Вся геометрия — в миллиметрах.** Якоря (`ViewAnchors`: neckline_point, center_axis_x, sleeve_*, axes) и полигоны зон (`polygon_mm`) хранятся в ММ флэта; админ-канвас пишет мм, геометрия читает мм. Пиксели SVG (`naturalWidth`) — «единицы вида»; мм = единицы × `scale_mm_per_unit`. Путать эти пространства — классический источник багов (см. MEMORY.md).

**Поток данных каталога:**
```
public/seed/skus.json (заводские SKU, zod-схема lib/catalog/schema.ts)
        │
        ▼
lib/catalog/mergedCatalog.ts  ← lib/persistence/models.ts (Supabase | localStorage)
  mergeCatalog: модель с seed-id ПЕРЕКРЫВАЕТ seed на месте (override),
  остальные модели — кастомные; ОДИН проход expandCatalogGradeRules.
        │
        ├─ развёрнутые skus → витрина (SkuPicker), редактор (projectStore)
        └─ rawModels (СЫРЫЕ строки) → админка-редактор
```
**Критичный инвариант:** редактор/дубль/toggle в админке работают с `raw ?? sku` — развёрнутая копия содержит запечённые `size_anchors`, которые делают `grade_rule` инертным. «Сбросить к заводской» = `deleteModel(id)`.

**Резолв «нанесение → вид»:** placement хранит `print_area_id`; вид находится через `viewHasZone(view, areaId)` (`lib/geometry/view.ts`) — ищет по базовым И всем per-size зонам. Не заменять на `view.print_areas.some(...)` — потеряются нанесения с per-size id.

**Per-size override заменяет объект ЦЕЛИКОМ** (`size_anchors[size]`, `size_print_areas[size]`, `size_flats[size]`): оси/зоны в override нужно повторять, merge полей нет.

**Экспорт PDF:** `lib/export/buildSceneSvg.ts` (единственный вариант — минимальный лист: шапка заказа + рисунок 1:1 + метка размера + шкала; full/production удалены в PR #58) → `exportScenesPdf` (jsPDF + svg2pdf, страницы в мм 1:1). Кириллица: LiberationSans из `public/fonts/` лениво регистрируется в jsPDF (`PDF_FONT_FAMILY` на корне SVG); технические подписи остаются latin-safe на случай фоллбэка. Перед любым экспортом — `lib/export/preflight.ts`.

**Загрузка PDF/AI:** `lib/catalog/loadPdf.ts` через pdfjs-dist@4 legacy; worker НЕ бандлится — копируется postinstall-скриптом в `public/pdf.worker.min.mjs` (в .gitignore). Не убирать postinstall и не пытаться импортировать worker через webpack — он не парсится.

**Recolor-контракт флэтов:** SVG флэта содержит `<g id="garment" fill="...">`; перекраска — regex-заменой fill этой группы (`lib/hooks/useColoredFlat`, 202 контрактных теста в seedFlats.test.ts). Новые флэты обязаны соблюдать контракт (скилл flat-svg-convention).

**Персистентность:** Supabase (`pinhead_projects`, `pinhead_models`; RLS anon ALL — осознанно, внутренний инструмент) с полным фоллбэком на localStorage. Облако — best-effort: `loadMergedCatalog` имеет 5-секундный таймаут, недоступный Supabase не блокирует каталог. (Таблица `pinhead_model_revisions` осталась в БД, но кодом больше не используется — история версий выпилена в PR #56.)

**Стор редактора:** zustand (`lib/state/projectStore.ts`). Мутации раскладки пушат снимок в undo-историю (`pushHistory`, cap 50). Смена размера регрейдит позиции (константа отступа от горловины, BUILD.md §4).

## Конвенции

- Спецификация и модель данных — **BUILD.md** (источник правды). Проектные скилы: merch-geometry (всегда при расчётах позиций), flat-svg-convention, konva-mm-canvas, vector-pdf-export.
- UI — дизайн-система «Студия» (`design-system/` — референс, не импортируется): токены shell/paper/line/raised, иконки lucide-react. Комментарии в коде — по-русски.
- `lib/` — чистая логика без UI, покрывается vitest; компоненты тестами не покрываются, для них — runtime-смоук.
- Типы — только из `types/index.ts`; схема каталога `lib/catalog/schema.ts` должна оставаться синхронной с типами.

## Окружение и деплой

- CI/CD: Vercel — push в `main` = прод, push ветки = preview. Merge PR в main достаточно для деплоя (~40-60 с). `.env.production` с NEXT_PUBLIC_SUPABASE_* закоммичен намеренно (публичные ключи).
- В песочнице Claude браузер не ходит наружу: прод проверяй `curl`, Supabase — напрямую `@supabase/supabase-js` из node-скрипта.
- `pkill` в цепочке `&&` убивает и сам шелл (exit 144) — глуши dev-сервер ОТДЕЛЬНОЙ командой; не гоняй `next build` параллельно с dev-сервером (общий `.next`).
