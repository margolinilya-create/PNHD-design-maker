import React from "react";

/**
 * Select — styled native dropdown. Native <select> under the hood for
 * reliability; appearance is reset and a Lucide chevron is overlaid.
 * Light inset matching Field.
 */
export function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  size = "md",
  style,
  selectStyle,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const sz =
    size === "sm"
      ? { pad: "4px 26px 4px 8px", font: "var(--text-xs)" }
      : { pad: "6px 28px 6px 9px", font: "var(--text-sm)" };

  return (
    <label style={{ display: "block", fontFamily: "var(--font-base)", ...style }}>
      {label && (
        <span style={{ display: "block", marginBottom: "var(--space-1)", fontSize: "var(--text-xs)", color: "var(--text-label)" }}>
          {label}
        </span>
      )}
      <span style={{ position: "relative", display: "block" }}>
        <select
          value={value}
          onChange={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            width: "100%",
            padding: sz.pad,
            fontSize: sz.font,
            fontFamily: "var(--font-base)",
            color: "var(--text-body)",
            background: "var(--surface-panel)",
            border: `var(--border-width) solid ${focus ? "var(--focus-ring)" : "var(--border-base)"}`,
            boxShadow: focus ? "0 0 0 3px var(--blue-50)" : "none",
            borderRadius: "var(--radius-sm)",
            outline: "none",
            cursor: "pointer",
            ...selectStyle,
          }}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) =>
            typeof o === "string" ? (
              <option key={o} value={o}>{o}</option>
            ) : (
              <option key={o.value} value={o.value}>{o.label}</option>
            ),
          )}
        </select>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-hint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </label>
  );
}
