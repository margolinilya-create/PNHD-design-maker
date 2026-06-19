import React from "react";

export interface ModalProps {
  /** Render when true. @default true */
  open?: boolean;
  /** Dismiss handler (scrim click + × button). Omit to hide the ×. */
  onClose?: () => void;
  /** Header title. */
  title?: React.ReactNode;
  /** Footer action row (usually Buttons). Omit for no footer. */
  footer?: React.ReactNode;
  /** Max width in px. @default 420 */
  width?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Centered dialog over a dimmed scrim — preflight, grading review, batch.
 * White paper, soft xl shadow, optional footer action row.
 *
 * @startingPoint section="Feedback" subtitle="Modal dialog" viewport="700x320"
 */
export function Modal(props: ModalProps): JSX.Element;
