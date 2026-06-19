import React from "react";

export interface TabProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Selected state — solid blue fill. */
  active?: boolean;
  /** Optional count badge (placements on this view, etc). 0/undefined hides it. */
  count?: number;
  children?: React.ReactNode;
}

/**
 * Segmented selector button. Lay several in a `display:flex; gap:6px` row.
 * Active tab is solid blue-600; inactive tabs are gray-800.
 */
export function Tab(props: TabProps): JSX.Element;
