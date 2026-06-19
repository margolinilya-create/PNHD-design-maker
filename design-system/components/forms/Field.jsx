import React from "react";

/**
 * Field — a labeled text/number input. Dark inset on the panel:
 * gray-900 fill, gray-700 border, blue focus ring. The compact label
 * sits above in gray-400. Use `suffix` for unit hints like "мм".
 */
export function Field({
  label,
  suffix,
  numeric = false,
  hint,
  style,
  inputStyle,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);

  return (
    <label style={{ display: "block", fontFamily: "var(--font-base)", ...style }}>
      {label && (
        <span
          style={{
            display: "block",
            marginBottom: "var(--space-1)",
            fontSize: "var(--text-xs)",
            color: "var(--text-label)",
          }}
        >
          {label}
        </span>
      )}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          background: "var(--surface-panel)",
          border: `var(--border-width) solid ${
            focus ? "var(--focus-ring)" : "var(--border-base)"
          }`,
          borderRadius: "var(--radius-sm)",
          boxShadow: focus ? "0 0 0 3px var(--blue-50)" : "none",
          transition: `border-color var(--motion-base) var(--ease-standard)`,
        }}
      >
        <input
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "6px 8px",
            fontSize: "var(--text-sm)",
            fontFamily: "var(--font-base)",
            fontVariantNumeric: numeric ? "tabular-nums" : "normal",
            color: "var(--text-body)",
            background: "transparent",
            border: "none",
            outline: "none",
            ...inputStyle,
          }}
          {...rest}
        />
        {suffix && (
          <span
            style={{
              padding: "0 8px 0 4px",
              fontSize: "var(--text-xs)",
              color: "var(--text-hint)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {suffix}
          </span>
        )}
      </span>
      {hint && (
        <span
          style={{
            display: "block",
            marginTop: "var(--space-1)",
            fontSize: "var(--text-xs)",
            color: "var(--text-hint)",
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}
