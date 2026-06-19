import React from "react";

/**
 * Card — bordered panel surface. The catalog (SKU) tiles, modals,
 * and layer rows are all Cards. `interactive` adds the blue hover
 * border; `selected` pins it on with a raised fill.
 */
export function Card({
  interactive = false,
  selected = false,
  padding = "lg",
  as = "div",
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const Tag = as;

  const pad = {
    none: 0, sm: "var(--space-2)", md: "var(--space-3)",
    lg: "var(--space-4)", xl: "var(--space-5)",
  }[padding] ?? "var(--space-4)";

  const borderColor =
    selected || (interactive && hover)
      ? "var(--border-selected)"
      : "var(--border-base)";
  const bg = selected
    ? "var(--blue-50)"
    : interactive && hover
      ? "var(--surface-sunken)"
      : "var(--surface-panel)";

  return (
    <Tag
      onMouseEnter={interactive ? () => setHover(true) : undefined}
      onMouseLeave={interactive ? () => setHover(false) : undefined}
      style={{
        padding: pad,
        background: bg,
        border: `var(--border-width) solid ${borderColor}`,
        borderRadius: "var(--radius-xl)",
        boxShadow: interactive && !selected ? "var(--shadow-sm)" : "none",
        color: "var(--text-body)",
        fontFamily: "var(--font-base)",
        cursor: interactive ? "pointer" : "default",
        transition: `background var(--motion-base) var(--ease-standard), border-color var(--motion-base) var(--ease-standard)`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
