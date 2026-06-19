import React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** Lucide icon name, kebab-case (e.g. "upload", "trash-2", "chevron-left"). */
  name: string;
  /** Pixel size (width = height). @default 16 */
  size?: number;
  /** Stroke width. @default 1.75 */
  strokeWidth?: number;
}

/**
 * Inline Lucide glyph. The host page must load the Lucide UMD bundle once
 * (window.lucide). Inherits color via `currentColor`.
 */
export function Icon(props: IconProps): JSX.Element;
