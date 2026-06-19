import React from "react";

/**
 * Chip — small labelled token: view tags, DPI/method badges, status
 * pills, comment roles, "за зоной" warnings. Tonal palette maps to the
 * semantic intents; `variant` picks the fill treatment.
 */
export function Chip({
  tone = "neutral",
  variant = "soft",
  size = "md",
  children,
  style,
  ...rest
}) {
  const tones = {
    neutral: { solid: "var(--gray-600)",    soft: "var(--surface-raised)", softFg: "var(--gray-600)",    line: "var(--border-strong)" },
    blue:    { solid: "var(--blue-600)",    soft: "var(--blue-50)",        softFg: "var(--blue-700)",    line: "var(--blue-600)" },
    emerald: { solid: "var(--emerald-600)", soft: "var(--emerald-50)",     softFg: "var(--emerald-700)", line: "var(--emerald-600)" },
    amber:   { solid: "var(--amber-600)",   soft: "var(--amber-50)",       softFg: "var(--amber-700)",   line: "var(--amber-600)" },
    red:     { solid: "var(--red-600)",      soft: "var(--red-50)",         softFg: "var(--red-700)",     line: "var(--red-600)" },
  }[tone] ?? null;

  const t = tones ?? { solid: "var(--gray-600)", soft: "var(--surface-raised)", softFg: "var(--gray-600)", line: "var(--border-strong)" };

  const sz = {
    sm: { padding: "0 5px", fontSize: "var(--text-2xs)", height: 16 },
    md: { padding: "2px 8px", fontSize: "var(--text-xs)", height: 20 },
    lg: { padding: "4px 10px", fontSize: "var(--text-xs)", height: 24 },
  }[size] ?? { padding: "2px 8px", fontSize: "var(--text-xs)", height: 20 };

  let bg = "transparent";
  let fg = t.softFg;
  let border = "transparent";
  if (variant === "solid") { bg = t.solid; fg = "var(--text-on-accent)"; }
  else if (variant === "soft") { bg = t.soft; fg = t.softFg; }
  else if (variant === "outline") { bg = "transparent"; fg = t.softFg; border = t.line; }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        height: sz.height,
        padding: sz.padding,
        fontSize: sz.fontSize,
        fontWeight: "var(--weight-medium)",
        fontFamily: "var(--font-base)",
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: fg,
        background: bg,
        border: `var(--border-width) solid ${border}`,
        borderRadius: "var(--radius-sm)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
