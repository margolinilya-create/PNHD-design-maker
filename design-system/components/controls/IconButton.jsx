import React from "react";

/**
 * IconButton — compact square control for a Lucide icon. Pass `icon`
 * (a Lucide name) or arbitrary children. Used in toolbars and layer-row
 * action clusters. Always supply a `title`.
 *
 * Note: the Lucide-SVG renderer is inlined here (not imported from Icon.jsx)
 * so the bundler surfaces both `Icon` and `IconButton` as separate exports.
 * Requires the Lucide UMD bundle on the page (window.lucide).
 */
function lucidePascal(name) {
  return String(name)
    .split(/[-_ ]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

function LucideSvg({ name, size = 17, strokeWidth = 1.75 }) {
  const inner = React.useMemo(() => {
    const lib = typeof window !== "undefined" ? window.lucide : null;
    if (!lib) return "";
    const key = lucidePascal(name);
    const node =
      (lib.icons && (lib.icons[key] || lib.icons[name])) || lib[key] || null;
    if (!node || !Array.isArray(node)) return "";
    const children =
      typeof node[0] === "string" ? (Array.isArray(node[2]) ? node[2] : []) : node;
    return children
      .map(([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs || {})
          .map(([k, v]) => `${k}="${v}"`)
          .join(" ")} />`,
      )
      .join("");
  }, [name]);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flex: "none" }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

export function IconButton({
  icon,
  iconSize,
  size = "md",
  variant = "ghost",
  danger = false,
  active = false,
  disabled = false,
  title,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);

  const dims = {
    sm: { box: 24, icon: 15, radius: "var(--radius-sm)" },
    md: { box: 30, icon: 17, radius: "var(--radius-md)" },
  }[size] ?? { box: 30, icon: 17, radius: "var(--radius-md)" };

  let bg = "transparent";
  let fg = "var(--text-label)";
  if (active) {
    bg = "var(--intent-primary)";
    fg = "var(--text-on-accent)";
  } else if (hover && !disabled) {
    bg = "var(--surface-raised)";
    fg = danger ? "var(--intent-danger)" : "var(--text-heading)";
  }
  if (variant === "filled" && !active) {
    bg = hover && !disabled ? "var(--surface-raised)" : "var(--surface-sunken)";
    fg = "var(--text-body)";
  }

  return (
    <button
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dims.box,
        height: dims.box,
        padding: 0,
        color: fg,
        background: bg,
        border: "none",
        borderRadius: dims.radius,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: `background var(--motion-base) var(--ease-standard), color var(--motion-base) var(--ease-standard)`,
        ...style,
      }}
      {...rest}
    >
      {icon ? <LucideSvg name={icon} size={iconSize ?? dims.icon} /> : children}
    </button>
  );
}
