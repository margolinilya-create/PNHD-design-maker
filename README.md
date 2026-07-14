# PINHEAD — Merch Preview

Внутренний инструмент превью и **технических рисунков-раскладок** мерча:
раскладка нанесений на изделие в реальном масштабе (мм), проверка ростовки и
печатных зон, экспорт векторного тех-листа PDF 1:1.

Стек: **Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · react-konva ·
zustand · zod · jsPDF/svg2pdf**. Опциональный бэкенд — **Supabase** (иначе
проекты хранятся в `localStorage`).

## Быстрый старт

```bash
npm install
cp .env.example .env.local   # опционально: ключи Supabase для облачного сохранения
npm run dev                  # http://localhost:3000
```

### Скрипты

| Команда | Назначение |
|---|---|
| `npm run dev` | Дев-сервер |
| `npm run build` | Продакшен-сборка |
| `npm run start` | Запуск собранного приложения |
| `npm run lint` | ESLint (`next lint`) |
| `npm run typecheck` | Проверка типов (`tsc --noEmit`) |
| `npm run test` | Юнит-тесты (Vitest) |
| `npm run test:watch` | Тесты в watch-режиме |

## Маршруты

- `/` — витрина каталога SKU, вход в редактор.
- `/editor` — редактор раскладки на холсте (react-konva), инспектор, экспорт PDF.
- `/admin` — редактор лекал: загрузка флэта (SVG/PNG) или импорт DXF, разметка
  якорей/зон, ростовки, сборка JSON SKU.
- `/styleguide` — витрина дизайн-системы «Студия».

## Структура

```
app/                 # маршруты App Router (editor, admin, styleguide) + layout, globals.css
components/           # React-компоненты по доменам
  catalog/  editor/  admin/
lib/                 # бизнес-логика (без UI), покрыта тестами
  geometry/          # координатная математика, отступы, обвязка, grading (мм)
  catalog/           # каталог SKU, seed-валидация (zod), DPI, методы печати, Pantone
  export/            # сборка сцены SVG → векторный PDF, preflight-чеклист
  import/            # парсинг DXF → SKU
  admin/             # модель редактора лекал (флэт, авто-маска, геометрия мокапа)
  state/             # zustand-стор проекта
  persistence/       # save/load проектов и моделей (Supabase | localStorage)
  hooks/             # React-хуки (useImage, useColoredFlat, ...)
types/               # общие типы модели данных (единый источник)
public/seed/         # эталонные данные: skus.json, флэты, мокапы (SKU FreeFit)
design-system/       # «Студия» — источник правды по токенам/паттернам (референс, не импортируется)
scripts/             # Python: DXF → флэт/SKU (dxf_analyze, dxf_build_sku, dxf_to_flat)
docs/                # ROADMAP, PLAN, COMPETITOR-BRIEF
.claude/             # агенты и скилы проекта
BUILD.md             # спецификация и модель данных (источник правды для архитектуры)
```

Импорты — через алиас `@/*` (см. `tsconfig.json`). Вся геометрия — в **миллиметрах**;
якоря привязаны к изделию (горловина/центр/низ рукава), не к холсту.

## Переменные окружения

См. `.env.example`. Без переменных Supabase приложение работает полностью на
`localStorage`.

| Переменная | Назначение |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase (облачное сохранение) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Публичный anon-ключ Supabase |

## Деплой

Приложение — статически пререндеренный Next.js, разворачивается на **Vercel**
как есть. Для облачного сохранения задайте переменные Supabase в настройках
проекта Vercel и примените миграции (таблицы `pinhead_projects`, `pinhead_models`
+ RLS) — детали в `docs/ROADMAP.md`.

## Документация

- `BUILD.md` — спецификация и модель данных.
- `CLAUDE.md` — гайд для Claude Code: команды, архитектура, инварианты, ловушки.
- `MEMORY.md` — живая память проекта: состояние, решения, бэклог (обновляется после значимых изменений).
- `docs/ROADMAP.md`, `docs/PLAN.md` — статус фич (P0/P1/P2 реализованы).
- `HANDOFF.md` — история ре-скина под дизайн-систему «Студия».
