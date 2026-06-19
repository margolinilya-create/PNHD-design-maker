Round color-select button used by the garment-color and Pantone pickers. The empty-string swatch is the "as drawn / no color" option.

```jsx
<div style={{ display: "flex", gap: 6 }}>
  <Swatch color="" />                 {/* — no color */}
  <Swatch color="#1b1f24" selected />
  <Swatch color="#3b4a6b" />
  <Swatch color="#7a2230" />
</div>
```

Garment presets live in tokens: `--garment-white/black/navy/maroon/forest/sand`.
