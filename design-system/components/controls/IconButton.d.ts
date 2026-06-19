import React from "react";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Lucide icon name (kebab-case). Shorthand for <Icon> as the child. */
  icon?: string;
  /** Override icon px size. */
  iconSize?: number;
  /** @default "md" */
  size?: "sm" | "md";
  /** "ghost" (transparent) or "filled" (sunken gray). @default "ghost" */
  variant?: "ghost" | "filled";
  /** Red hover for destructive actions (delete). */
  danger?: boolean;
  /** Toggled-on look (blue fill). */
  active?: boolean;
  disabled?: boolean;
  /** Native tooltip — always supply one; the icon carries no label. */
  title?: string;
  /** Custom content if not using `icon`. */
  children?: React.ReactNode;
}

/**
 * Compact square button wrapping a Lucide `Icon`. Pass `icon="trash-2"` etc.
 * Always pass `title`. Requires the Lucide UMD script on the page.
 */
export function IconButton(props: IconButtonProps): JSX.Element;
