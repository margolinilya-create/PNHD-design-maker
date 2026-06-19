import React from "react";

export interface SwatchProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** CSS color. Empty string renders the "—" no-color chip. */
  color?: string;
  /** Selected — blue ring. */
  selected?: boolean;
  /** @default "md" */
  size?: "sm" | "md";
  title?: string;
}

/**
 * Round color-select button (garment color, Pantone spot picker).
 * Lay several in a flex row with gap-1.5; the empty-string swatch means
 * "as drawn / no color".
 */
export function Swatch(props: SwatchProps): JSX.Element;
