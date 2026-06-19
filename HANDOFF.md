# Задание для Claude Code — миграция PINHEAD на дизайн-систему «Студия»

Перенести приложение **margolinilya-create/PNHD-design-maker** (Next.js + React + TS + Tailwind) с тёмной темы на новую светлую систему **PINHEAD «Студия»**. Дизайн-система собрана отдельно — используй её как источник правды (скопируй `SKILL.md`, `readme.md`, `tokens/`, `components/`, `assets/` в репозиторий, например в `design-system/`, и читай оттуда).

## Цель
Светлый, чистый, плотный продуктовый интерфейс (Notion/Vercel-воздух + Linear-структура): серый шелл, белые панели на мягких тенях, левый рельс инструментов, синий акцент, иконки **Lucide**. Русский UI, единицы — мм. «Лёгкий намёк» на инженерную ДНК сохраняем только на холсте редактора (синие пунктирные зоны, размерные линии).

## Шаги

1. **Токены.** Замени `:root` в `app/globals.css` на CSS-переменные из `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css` (или `@import` их). Ключевое: `--shell #f6f7f9`, `--paper #ffffff`, текст `--gray-900/600/500/400`, границы `--gray-200`, акцент `--blue-600` (hover `--blue-700`), confirm `--emerald-600`. `body { background: var(--shell); color: var(--gray-600); }`.

2. **Tailwind.** В `tailwind.config.ts` пропиши палитру через эти переменные (`theme.extend.colors`) или просто заменяй классы на семантические значения. Маппинг старых тёмных классов:
   - `bg-neutral-950/900` (холст/панели) → `bg-[var(--shell)]` / `bg-white`
   - `bg-neutral-800` (чипы/кнопки) → `bg-[var(--surface-raised)]` (#eef0f3)
   - `border-neutral-700/800` → `border-[var(--border-base)]` (#e4e7ec)
   - `text-neutral-200/300/400/500` → `text-gray-900/600/500/400`
   - `bg-blue-600` (active/primary) — оставить; hover `bg-blue-700` (раньше был 500)
   - `bg-emerald-600` (export CTA) — оставить; «approved» `bg-green-600`
   - чипы soft: тёмные `bg-*-950 text-*-300` → светлые `bg-*-50 text-*-700`
   - радиусы крупные (`rounded-xl 12px`) → мельче: карточки/модалки `rounded-md/lg` (6px), кнопки `rounded` (5px), чипы/инпуты `rounded-sm` (3px)
   - добавить мягкие тени: карточки `shadow-sm`, поповеры `shadow-md`, модалки `shadow-xl` (значения в `tokens/spacing.css`)

3. **Иконки → Lucide.** Установи `lucide-react`. Замени Unicode-глифы и эмодзи на компоненты:
   `↶/↷` → `Undo2/Redo2`, `←` → `ChevronLeft`, `+` → `Plus`, `✕` → `X`, `▲/▼` → `ChevronUp/Down`, `⎘` → `Copy`, `👁/🙈` → `Eye/EyeOff`, `🔒/🔓` → `Lock/LockOpen`, `⚠` → `TriangleAlert`, `✓` → `Check`, загрузка → `Upload`, экспорт → `FileDown`, линейка → `Ruler`, проверка лекала → `ScanSearch`, слои → `Layers`, SKU → `Shirt`. Stroke 1.75, размер 16–18.

4. **Левый рельс.** Добавь в `app/editor/page.tsx` вертикальную панель `w-[52px]` слева (иконки `LayoutGrid, Shirt, Ruler, Layers, Settings`), активный пункт — синяя заливка. Шелл редактора: `rail | (header над canvas) | sidepanel 294px`.

5. **Холст (`components/editor/EditorCanvas.tsx`).** Только перекрась под свет, логику не трогай:
   - фон Stage/контейнера → `--shell` (#f6f7f9), флэт остаётся (tint по `garmentColor`)
   - зона `#2563eb` пунктир, fill `rgba(37,140,235,0.05)`; safe `#16a34a`; сетка `rgba(37,99,235,0.08)`
   - размерные линии `#94a3b8`, подписи `#475569` на **белых** halo (`rgba(255,255,255,0.85)`); линейка `#d97706`; якорь/за-зоной `#e11d48`; W×H — белый текст на `#2563eb`

6. **Компоненты.** Перенеси паттерны из `components/` дизайн-системы (Button/Tab/Chip/Field/Select/Switch/Card/Modal/IconButton) — значения цветов/радиусов/теней те же. «Только просмотр» сделай через `Switch`. Модалки (preflight, проверка ростовки, batch) — через `Modal` (белая карточка, scrim `rgba(17,24,39,0.45)`, `shadow-xl`).

7. **Тех-лист PDF.** Свёрстай экспортный лист по образцу `templates/tech-sheet/TechSheet.dc.html`: титульный блок (SKU/размер/клиент/заказ/дата/статус), флэт с обвязкой, таблица спецификации, легенда линий, footer с подписью. Масштаб 1:1, `@page A4 landscape`.

## Не менять
Бизнес-логику (`lib/geometry`, `lib/export`, `lib/catalog`), модель данных, метрику в мм, поведение grading. Это **только визуальный** ре-скин под светлую тему + Lucide + левый рельс.

## Приёмка
- Нет тёмных поверхностей; шелл серый, панели белые, тени мягкие.
- Все иконки — Lucide (ни одного эмодзи/глифа).
- Холст читается на светлом; размерные числа в белых halo.
- Сборка/типчек/линт чистые; экспорт PDF 1:1 в мм не сломан.
