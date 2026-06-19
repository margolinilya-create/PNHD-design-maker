import React from "react";

export interface FieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label rendered above the input (gray-400, 12px). */
  label?: string;
  /** Trailing unit hint inside the field, e.g. "мм" or "°". */
  suffix?: string;
  /** Use tabular figures — set for metric/number inputs. */
  numeric?: boolean;
  /** Helper line below the field (gray-500, 12px). */
  hint?: string;
  /** Style for the wrapping <label>. */
  style?: React.CSSProperties;
  /** Style merged onto the inner <input>. */
  inputStyle?: React.CSSProperties;
}

/**
 * Labeled text/number input. Gray-900 inset, blue focus ring.
 * For metric entry pass `numeric` + `suffix="мм"`.
 */
export function Field(props: FieldProps): JSX.Element;
