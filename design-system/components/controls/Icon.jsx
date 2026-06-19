import React from "react";

/**
 * Icon — renders a Lucide glyph as inline SVG. PINHEAD's redesign adopts
 * Lucide (thin 1.75 stroke) as its single icon set. Reads icon node data
 * from the Lucide UMD global (`window.lucide`), so the host page must load
 * it once: <script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js">.
 * Falls back to an empty box if Lucide isn't present yet.
 */
function pascal(name) {
  return String(name)
    .split(/[-_ ]+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

export function Icon({ name, size = 16, strokeWidth = 1.75, style, ...rest }) {
  const inner = React.useMemo(() => {
    const lib = typeof window !== "undefined" ? window.lucide : null;
    if (!lib) return "";
    const key = pascal(name);
    const node =
      (lib.icons && (lib.icons[key] || lib.icons[name])) || lib[key] || null;
    if (!node || !Array.isArray(node)) return "";
    // Lucide nodes are ["svg", attrs, [ [tag, attrs], ... ]] tuples.
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
      style={{ display: "block", flex: "none", ...style }}
      dangerouslySetInnerHTML={{ __html: inner }}
      {...rest}
    />
  );
}
