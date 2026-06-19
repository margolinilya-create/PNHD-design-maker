---
name: pinhead-design
description: Use this skill to generate well-branded interfaces and assets for PINHEAD (PNHD) — an internal merch preview & technical-drawing tool for an apparel print shop — either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Quick orientation:
- `styles.css` is the single stylesheet to link; it `@import`s all tokens in `tokens/`. Design against the semantic aliases (`--surface-*`, `--text-*`, `--intent-*`, `--canvas-*`).
- PINHEAD is a **light, clean, dense** product tool («Студия» direction): soft gray app shell, white panels on soft shadows, left tool rail. Russian UI, terse imperative copy, "ты", units always in mm. One blue accent (interactive) + one emerald accent (confirm). The signature is the metric "blueprint" canvas — see `guidelines/colors-canvas.card.html` and `ui_kits/merch-preview/EditorCanvas.jsx`.
- Icons are **Lucide** (thin 1.75 stroke) via the `Icon` / `IconButton` components; load the Lucide UMD script on the page.
- Components live in `components/` (`Button`, `IconButton`, `Icon`, `Tab`, `Field`, `Swatch`, `Card`, `Chip`). The full product is recreated in `ui_kits/merch-preview/`.
- Real garment assets are in `assets/`.
