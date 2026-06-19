import React from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  /** Label above the control (gray, 12px). */
  label?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  /** Options as plain strings or {value,label} objects. */
  options?: (string | SelectOption)[];
  /** Leading empty option text. */
  placeholder?: string;
  /** @default "md" */
  size?: "sm" | "md";
  style?: React.CSSProperties;
  selectStyle?: React.CSSProperties;
}

/**
 * Styled dropdown over a native <select> (reliable keyboard + mobile),
 * with a Lucide chevron. Matches Field's light inset + blue focus ring.
 */
export function Select(props: SelectProps): JSX.Element;
