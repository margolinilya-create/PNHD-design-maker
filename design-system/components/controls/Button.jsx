import React from "react";

/**
 * PINHEAD Button — the workhorse action control.
 * Rounded-lg, medium weight, quiet by default. `confirm` is reserved
 * for the one terminal action on a screen (export / build).
 */
export function Button({
  variant = "neutral",
  size = "md",
  fullWidth = false,
  disabled = false,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);

  const sizes = {
    sm: { padding: "4px 10px", fontSize: "var(--text-xs)", fontWeight: "var(--weight-medium)" },
    md: { padding: "8px 12px", fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)" },
    cta: { padding: "10px 12px", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)" },
  };

  const variants = {
    primary: {
      bg: "var(--intent-primary)", bgHover: "var(--intent-primary-hover)",
      fg: "var(--text-on-accent)", border: "transparent",
    },
    confirm: {
      bg: "var(--intent-confirm)", bgHover: "var(--intent-confirm-hover)",
      fg: "var(--text-on-accent)", border: "transparent",
    },
    neutral: {
      bg: "var(--surface-raised)", bgHover: "var(--gray-200)",
      fg: "var(--text-body)", border: "transparent",
    },
    subtle: {
      bg: "var(--surface-sunken)", bgHover: "var(--surface-raised)",
      fg: "var(--text-body)", border: "transparent",
    },
    ghost: {
      bg: "transparent", bgHover: "var(--surface-raised)",
      fg: "var(--text-label)", border: "transparent",
    },
    outline: {
      bg: "var(--surface-panel)", bgHover: "var(--surface-sunken)",
      fg: "var(--text-heading)", border: "var(--border-base)",
    },
  };

  const v = variants[variant] ?? variants.neutral;
  const sz = sizes[size] ?? sizes.md;

  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-1_5)",
        width: fullWidth ? "100%" : "auto",
        padding: sz.padding,
        fontSize: sz.fontSize,
        fontWeight: sz.fontWeight,
        fontFamily: "var(--font-base)",
        lineHeight: 1,
        color: v.fg,
        background: disabled ? "var(--surface-raised)" : hover ? v.bgHover : v.bg,
        border: `var(--border-width) solid ${
          variant === "outline" && hover ? "var(--border-strong)" : v.border
        }`,
        borderRadius: "var(--radius-lg)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: `background var(--motion-base) var(--ease-standard), border-color var(--motion-base) var(--ease-standard)`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
