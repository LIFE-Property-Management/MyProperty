import { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "info"
  | "danger";

/**
 * Status → tone mapping for Phase 2 consumers. Pass the correct tone yourself;
 * the Badge does not know about domain enums.
 *
 * PaymentStatus.Outstanding → 'warning'
 * PaymentStatus.Pending     → 'info'
 * PaymentStatus.Confirmed   → 'success'
 * PaymentStatus.Rejected    → 'danger'
 *
 * LeaseStatus.Active     → 'success'
 * LeaseStatus.Expired    → 'neutral'
 * LeaseStatus.Terminated → 'danger'
 *
 * TenantAccountStatus.Active   → 'success'
 * TenantAccountStatus.ReadOnly → 'neutral'
 */
export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const BASE_CLASSES =
  "inline-flex items-center " +
  "px-2.5 py-0.5 " +
  "rounded-full " +
  "text-xs font-medium " +
  "whitespace-nowrap";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-neutral-light text-muted-text",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  info: "bg-info-light text-info",
  danger: "bg-danger-light text-danger",
};

function Badge({ tone = "neutral", children, className }: BadgeProps) {
  const classes =
    BASE_CLASSES + " " + TONE_CLASSES[tone] + (className ? " " + className : "");

  return <span className={classes}>{children}</span>;
}

Badge.displayName = "Badge";

export { Badge };
export default Badge;
