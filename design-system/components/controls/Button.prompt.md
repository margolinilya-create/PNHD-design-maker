Primary action control for PINHEAD — quiet neutral by default; `confirm` (emerald) is the single terminal action like "Export PDF".

```jsx
<Button variant="confirm" size="cta" fullWidth>Экспорт PDF (1:1)</Button>
<Button variant="primary">Загрузить SVG / PNG</Button>
<Button variant="subtle" size="sm">Центр зоны</Button>
<Button variant="ghost" size="sm">Отмена</Button>
```

Variants: `primary` (blue interactive), `confirm` (emerald terminal CTA), `neutral` / `subtle` (gray fills), `ghost` (transparent→hover), `outline` (bordered, accents on hover). Sizes: `sm`, `md`, `cta`. Use `fullWidth` for stacked panel buttons.
