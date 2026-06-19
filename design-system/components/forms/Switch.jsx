import React from "react";

/**
 * Switch — boolean toggle. Blue track when on, white knob on a soft
 * shadow. The "только просмотр" / feature flags in the editor.
 */
export function Switch({
  checked = false,
  onChange,
  label,
  disabled = false,
  size = "md",
  style,
  ...rest
}) {
  const dims = size === "sm" ? { w: 32, h: 18 } : { w: 38, h: 22 };
  const knob = dims.h - 4;

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "var(--font-base)",
        ...style,
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          position: "relative",
          width: dims.w,
          height: dims.h,
          flex: "none",
          padding: 0,
          border: "none",
          borderRadius: "var(--radius-full)",
          background: checked ? "var(--intent-primary)" : "var(--gray-300)",
          cursor: "inherit",
          transition: `background var(--motion-base) var(--ease-standard)`,
        }}
        {...rest}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? dims.w - knob - 2 : 2,
            width: knob,
            height: knob,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "var(--shadow-sm)",
            transition: `left var(--motion-base) var(--ease-standard)`,
          }}
        />
      </button>
      {label && (
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-body)" }}>{label}</span>
      )}
    </label>
  );
}
