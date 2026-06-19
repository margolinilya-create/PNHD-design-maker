import React from "react";

export type ChipTone = "neutral" | "blue" | "emerald" | "amber" | "red";

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Semantic color. @default "neutral" */
  tone?: ChipTone;
  /** Fill treatment. `soft` = dark tinted bg + light text (default);
   *  `solid` = full color; `outline` = bordered. */
  variant?: "soft" | "solid" | "outline";
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}

/**
 * Small labelled token: view tags, DPI/method badges, status pills,
 * comment roles, "за зоной" warnings. Rounded-sm, never pill-shaped.
 */
export function Chip(props: ChipProps): JSX.Element;
