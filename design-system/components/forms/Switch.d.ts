import React from "react";

export interface SwitchProps {
  /** On/off state (controlled). */
  checked?: boolean;
  /** Called with the next boolean. */
  onChange?: (next: boolean) => void;
  /** Optional trailing label. */
  label?: string;
  disabled?: boolean;
  /** @default "md" */
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

/**
 * Boolean toggle — blue track when on, white knob on a soft shadow.
 * For mode flags like "только просмотр".
 */
export function Switch(props: SwitchProps): JSX.Element;
