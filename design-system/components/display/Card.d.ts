import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** Adds blue hover border + raised fill (catalog tiles, list rows). */
  interactive?: boolean;
  /** Pinned selected look (blue border, gray-800 fill). */
  selected?: boolean;
  /** Inner padding step. @default "lg" */
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  /** Element to render as. @default "div" */
  as?: keyof JSX.IntrinsicElements;
  children?: React.ReactNode;
}

/**
 * Bordered panel surface — catalog tiles, modals, layer rows.
 * gray-900 fill / gray-700 border, rounded-xl.
 *
 * @startingPoint section="Display" subtitle="Card surfaces & states" viewport="700x220"
 */
export function Card(props: CardProps): JSX.Element;
