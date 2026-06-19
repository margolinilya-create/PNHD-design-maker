Segmented selector for switching views or modes — e.g. garment faces. Place several in a `display:flex; gap:6px` row and drive `active` yourself.

```jsx
<div style={{ display: "flex", gap: 6 }}>
  <Tab active>Перед</Tab>
  <Tab count={2}>Спина</Tab>
  <Tab>Рукав (л)</Tab>
</div>
```

Pass `count` to show a placement-count badge inside the tab.
