Centered dialog over a dimmed scrim — the preflight, grading-review, and batch dialogs. White paper, soft `xl` shadow, optional footer action row. Dismiss via scrim click or the × (shown when `onClose` is set).

```jsx
<Modal
  open={showExport}
  onClose={() => setShow(false)}
  title="Проверка перед экспортом"
  footer={<>
    <Button variant="ghost" onClick={() => setShow(false)}>Отмена</Button>
    <Button variant="confirm" onClick={run}>Экспортировать</Button>
  </>}
>
  Найдены предупреждения. Можно исправить или продолжить.
</Modal>
```
