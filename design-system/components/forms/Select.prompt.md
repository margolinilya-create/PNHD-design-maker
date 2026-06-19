Styled dropdown over a native `<select>` — matches `Field`'s light inset and blue focus ring, with a Lucide chevron overlay.

```jsx
<Select label="Копировать на вид…" placeholder="Выберите вид"
  options={["Перед", "Спина", "Рукав (л)"]} />

<Select label="Метод" value={m} onChange={(e) => setM(e.target.value)}
  options={[{ value: "dtf", label: "DTF" }, { value: "screen", label: "Шелкография" }]} />
```
