import React from "react";

/**
 * Modal — centered dialog over a dimmed scrim. The preflight / grading
 * review / batch dialogs. White paper, soft xl shadow, optional footer
 * action row. Click scrim or the × to dismiss.
 */
export function Modal({
  open = true,
  onClose,
  title,
  footer,
  width = 420,
  children,
  style,
}) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
        background: "var(--surface-overlay)",
        fontFamily: "var(--font-base)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: width,
          background: "var(--surface-panel)",
          border: "var(--border-width) solid var(--border-base)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-xl)",
          overflow: "hidden",
          ...style,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
            padding: "12px 14px",
            borderBottom: "var(--border-width) solid var(--border-subtle)",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", color: "var(--text-heading)" }}>
            {title}
          </h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 24, height: 24, padding: 0, border: "none", background: "transparent",
                borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-hint)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </header>
        <div style={{ padding: 14, fontSize: "var(--text-sm)", color: "var(--text-body)", lineHeight: "var(--leading-normal)" }}>
          {children}
        </div>
        {footer && (
          <footer
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-2)",
              padding: "12px 14px",
              borderTop: "var(--border-width) solid var(--border-subtle)",
              background: "var(--surface-sunken)",
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
