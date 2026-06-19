Compact square button wrapping a Lucide icon. Pass `icon` (a Lucide name); always supply `title` since the icon carries no text label.

```jsx
<IconButton title="Отменить (Ctrl+Z)" icon="undo-2" variant="filled" />
<IconButton title="Выше" icon="chevron-up" size="sm" />
<IconButton title="Дублировать" icon="copy" size="sm" />
<IconButton title="Удалить" icon="trash-2" size="sm" danger />
```

`active` gives the toggled blue-fill look; `danger` turns the hover red. Requires the Lucide UMD script loaded on the page.
