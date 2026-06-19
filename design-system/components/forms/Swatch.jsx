import React from "react";

/**
 * Swatch — round color-select button. The garment-color and Pantone
 * pickers in the editor. Selected gets a blue ring; an empty value
 * renders the "—" (no color / as-drawn) chip.
 */
export function Swatch({
  color = "",
  selected = false,
  size = "md",
  title,
  ...rest
}) {
  const dim = { sm: 20, md: 24 }[size] ?? 24;
  const empty = !color;

  return (
    <button
      title={title ?? (color || "без цвета")}
      style={{
        width: dim,
        height: dim,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "9px",
        color: "var(--text-hint)",
        background: empty ? "var(--surface-sunken)" : color,
        border: `var(--border-width) solid ${
          selected ? "var(--border-selected)" : "var(--border-strong)"
        }`,
        boxShadow: selected ? "0 0 0 2px var(--blue-100)" : "none",
        borderRadius: "var(--radius-full)",
        cursor: "pointer",
        transition: `box-shadow var(--motion-base) var(--ease-standard), border-color var(--motion-base) var(--ease-standard)`,
      }}
      {...rest}
    >
      {empty ? "—" : ""}
    </button>
  );
}
