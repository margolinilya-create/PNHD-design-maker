import React from "react";

/**
 * Tab — segmented selector. Active = solid blue-600; rest = gray-800.
 * Used for garment views (Перед / Спина / Рукав) and any small mode
 * switch. Optional count badge (e.g. number of placements on a view).
 */
export function Tab({
  active = false,
  count,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);

  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1_5)",
        padding: "6px 12px",
        fontSize: "var(--text-sm)",
        fontFamily: "var(--font-base)",
        lineHeight: 1,
        color: active ? "var(--text-on-accent)" : "var(--text-body)",
        background: active
          ? "var(--intent-primary)"
          : hover
            ? "var(--gray-200)"
            : "var(--surface-raised)",
        border: "none",
        borderRadius: "var(--radius-lg)",
        cursor: "pointer",
        transition: `background var(--motion-base) var(--ease-standard)`,
        ...style,
      }}
      {...rest}
    >
      {children}
      {count != null && count > 0 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 16,
            padding: "0 5px",
            fontSize: "var(--text-xs)",
            borderRadius: "var(--radius-full)",
            background: active ? "rgba(255,255,255,0.25)" : "var(--gray-200)",
            color: active ? "#fff" : "var(--text-label)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
