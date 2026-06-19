import React from "react";

export type ButtonVariant =
  | "primary"   // blue — the main interactive action
  | "confirm"   // emerald — the single terminal action (export/build)
  | "neutral"   // gray-700 filled
  | "subtle"    // gray-800 filled, lower emphasis
  | "ghost"     // transparent until hover
  | "outline";  // bordered, fills/accents on hover

export type ButtonSize = "sm" | "md" | "cta";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual intent. @default "neutral" */
  variant?: ButtonVariant;
  /** @default "md" */
  size?: ButtonSize;
  /** Stretch to container width (full-bleed panel buttons). */
  fullWidth?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * Primary action control. Rounded-lg, medium-weight, quiet by default.
 * Reserve `confirm` for one terminal action per screen.
 *
 * @startingPoint section="Controls" subtitle="Button variants & sizes" viewport="700x180"
 */
export function Button(props: ButtonProps): JSX.Element;
