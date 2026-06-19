# PINHEAD — Design System

A design system for **PINHEAD** (PNHD) — an internal, self-hosted **merch preview & technical-drawing tool** for an apparel print shop. An operator picks a garment SKU, drops a design onto a print zone, positions it with millimetre precision, and exports a single technical PDF (preview + dimensions) that goes to the client for sign-off and to the shop floor for production.

It is a *technical-drawing* tool, not a marketing-mockup tool: metric accuracy and dimension lines matter more than glamour. The **redesigned** system («Студия» direction) is **light and clean** — a soft gray app shell, white panels floating on gentle shadows, one blue accent for interaction and emerald for confirm. A *light hint* of the metric “blueprint” identity survives where it matters most: the editor canvas, where blue dashed zones and slate dimension lines sit over a garment flat.

> **Sources** (the reader may or may not have access; recorded for those who do):
> - GitHub: <https://github.com/margolinilya-create/PNHD-design-maker> — the Next.js + React + TypeScript app this system is distilled from. Worth exploring directly to build higher-fidelity PINHEAD designs: the editor (`components/editor/`), the metric library (`lib/geometry/`), and the spec (`BUILD.md`, `docs/`) are the canonical reference.
> - Related repos under the same owner (`pnhd-studio`, `pnhd_zakup`, `kontora24`) cover adjacent PINHEAD surfaces but were **not** used here — only the merch-preview tool is modelled.
>
> The product UI is in **Russian**; copy in this system keeps that.

---

## Content fundamentals

How PINHEAD writes.

- **Language: Russian.** UI strings, labels, hints, status — all Russian. Keep it that way unless asked otherwise.
- **Voice: terse, technical, operator-to-operator.** Short imperative labels: *"Загрузить SVG / PNG"*, *"Экспорт PDF (1:1)"*, *"Проверка ростовки"*. Hints are one clipped line: *"Отступ от горловины — константа на всех размерах."*
- **Address: informal "ты"** when the app speaks to the user — *"Выбери изделие, чтобы открыть редактор."* Never corporate "Вы".
- **Casing: sentence case** everywhere. No Title Case, no ALL-CAPS except tiny overline labels.
- **Numbers carry units, always in mm**, set in tabular figures: *"120 × 96 мм"*, *"312 dpi"*, *"отступ 75 мм"*. Inches appear only as a parenthetical preset name (*"Грудь (3″)"*).
- **No marketing fluff, no exclamation.** Confirmations are flat: *"PDF готов"*, *"Сохранено локально"*. Warnings are factual: *"за зоной"*, *"расхождение 1.4 мм"*.
- **Emoji:** **not used.** Affordances are Lucide icons via the `Icon` component; status is words + colored `Chip`s.
- **Domain vocabulary** (keep these exact terms): `лекало` (garment flat/pattern), `обвязка` (dimension framing), `нанесение` (a print placement), `зона` / `safe-зона` (print area / safe inset), `горловина` (neckline anchor), `ростовка` (size grading), `эталон` (reference/base size), `макет` (the artwork being printed), `цех` (the shop floor).

---

## Visual foundations

**Vibe.** Light, clean, product-grade — Notion/Vercel air with Linear-like structure. A soft gray app shell (`--shell` #f6f7f9) holds **white paper panels** that float on gentle, low-contrast shadows. Dense and operator-first, but calm. A left **tool rail** anchors navigation. The one place the old “engineering” soul shows through is the **canvas** — a light field with blue dashed zones and slate dimension arrows over a garment flat (CAD/technical-drawing, lightened).

**Color.** Slate-tinted grays are the chrome: `--surface-page` (#f6f7f9 shell) → `--surface-panel` (#ffffff paper) → `--surface-raised` (#eef0f3) → `--surface-sunken` (#f9fafb), hairline-bordered with `--border-base` (#e4e7ec). Text steps gray-900→gray-400. Accents are used narrowly:
- **Blue** (`--blue-600`, hover `--blue-700`) — interactive: primary buttons, active tabs, selection, focus, the garment center axis.
- **Emerald** (`--emerald-600`) — the *one* terminal/confirm action per screen (Export PDF) and the “approved” status.
- **Amber** (`--amber-600`) — the ruler/measure tool and alignment guides; soft warnings.
- **Red / rose** (`--red-600` / `--rose-600` #e11d48) — errors, the neckline anchor, and anything spilling past its print zone.

The **canvas palette** (see `tokens/colors.css` → “Canvas”) is the brand hint: zone `#2563eb` (dashed), safe-zone `#16a34a` (dashed), faint mm grid, dimension lines `#94a3b8` with dark text on **white halos** for legibility over a light garment.

**Type.** No webfont — the **OS-native UI sans** (`ui-sans-serif, system-ui, …`). Correct for a dense internal tool: instant, familiar, crisp at 11–14 px. Headings are bold with slightly tight tracking; metric readouts use **tabular figures**. A monospace token serves code/IDs.

**Spacing & shape.** Tight rhythm — `gap-1.5` (6 px) between chips/buttons, ~14 px panel padding, `gap` 18–20 px between sections. Radii are **crisp / engineering-leaning**: `sm` 3 px (chips/inputs), `md` 4 px (toolbar/icons), `lg` 5 px (buttons/rows), `xl` 6 px (cards/modals), `full` reserved for color swatches only. Borders are 1 px; `2 px` signals an out-of-zone alarm.

**Backgrounds.** Flat fills only — **no gradients, no textures behind UI**. The shell is one flat gray; panels are flat white. The only “image” surfaces are the garment flat (vector, on the canvas) and photo mockups (in client-preview exports). Modals dim the page with `rgba(17,24,39,.45)`.

**Cards & elevation.** A card = 1 px gray-200 border on white, `rounded-xl` (6 px), with a soft `--shadow-sm`. Interactive cards (catalog tiles, layer rows) gain a blue border on hover and a pale-blue (`--blue-50`) fill when selected. Shadows are soft and low-contrast (Linear/Vercel-grade): `sm` for resting cards, `lg` for popovers, `xl` for modals.

**Motion.** Quiet. ~150 ms ease on background/border color for hover and selection. No bounces, no entrance choreography, no decorative loops.

**Hover / press.** Hover = one-step-darker fill (raised→gray-200) or a blue border; links/icon buttons darken to heading color. Destructive icons turn red on hover. Filled accent buttons go one step darker on hover (blue-600→blue-700, emerald-600→emerald-700). Disabled = raised fill at 50 % opacity, `not-allowed`.

**Layout rules.** The editor is a fixed full-height shell: a **52 px left tool rail** (`--rail-width`), a thin top header (back · SKU · view tabs · undo/redo), a flex-1 canvas `main`, and a fixed **294 px** (`--sidepanel-width`) scrolling side panel on the right. The canvas letterboxes the flat with ~48 px padding and keeps screen zoom/pan separate from the metric mm scale.

---

## Iconography

The redesign adopts **Lucide** as PINHEAD's single icon set — thin **1.75 px** stroke, `currentColor`, rendered through the **`Icon`** component (and **`IconButton`** for clickable affordances; always pass a `title`). No emoji, no hand-drawn SVG. The host page loads the Lucide UMD bundle once (`https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js`); `Icon` reads glyph data from `window.lucide`.

Common names in use: `chevron-left/up/down`, `undo-2`, `redo-2`, `upload`, `file-down`, `eye` / `eye-off`, `lock` / `lock-open`, `copy`, `trash-2`, `ruler`, `scan-search`, `layers`, `shirt`, `layout-grid`, `settings`, `triangle-alert`, `check`, `plus`, `x`.

The garment **flats** (`assets/flat-*.svg`) and **photo mockups** (`assets/garment-*.jpg`) are real seed assets from the app, used on the canvas and in previews.

---

## What's in here (index)

**Foundations**
- `styles.css` — the single entry point consumers link. `@import`s only.
- `tokens/colors.css` — neutral ramp, semantic intents, the canvas/technical-drawing palette, garment presets.
- `tokens/typography.css` — font stack, size scale, weights, tabular-figure utility.
- `tokens/spacing.css` — spacing, radii, borders, shadows, layout primitives, motion.

**Components** (`window.PINHEADDesignSystem_32adb6.*`)
- `components/controls/` — **Button**, **IconButton**, **Icon** (Lucide), **Tab**.
- `components/forms/` — **Field**, **Select**, **Switch**, **Swatch**.
- `components/display/` — **Card**, **Chip**.
- `components/feedback/` — **Modal**.

Each has a `.jsx` (implementation), `.d.ts` (props + JSDoc), `.prompt.md` (one-line "what & when" + usage), and the directory carries one `@dsCard` HTML showing live states.

**UI kit**
- `ui_kits/merch-preview/` — interactive recreation of the PINHEAD tool: `index.html` (catalog → editor click-through), `Catalog.jsx`, `Editor.jsx`, `EditorCanvas.jsx` (the metric canvas), `SidePanel.jsx`. See its own `README.md`.

**Templates** (`templates/<slug>/` — starting folders consumers copy)
- `templates/tech-sheet/` — **Тех-лист (PDF 1:1)**: the print-ready technical sheet (title block + flat with dimension framing + placement spec + line-convention legend). `@page A4 landscape` print styles included.

**Specimen cards** (`guidelines/`) — the small HTML cards that populate the Design System tab (Colors, Type, Spacing, Brand).

**Assets** (`assets/`) — `flat-front.svg`, `flat-back.svg`, `flat-sleeve.svg` (vector garment flats), `garment-front.jpg`, `garment-back.jpg` (photo mockups).

**`SKILL.md`** — makes this folder usable as an Agent Skill in Claude Code.
