Bordered panel surface — the building block for catalog tiles, modals, and list rows. gray-900 fill, gray-700 border, rounded-xl.

```jsx
<Card interactive>
  <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-heading)" }}>
    FreeFit Classic Tee
  </div>
  <div style={{ marginTop: 4, color: "var(--text-label)" }}>tshirt · эталон L</div>
</Card>

<Card selected padding="md">Выбранный слой</Card>
```

`interactive` → blue hover border (clickable tiles); `selected` → pinned blue border + raised fill.
