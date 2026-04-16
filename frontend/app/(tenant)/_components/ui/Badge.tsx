'use client'

// Tenant Portal — Badge primitive.
// Presentational pill for status labels. Consumers map their domain status
// enums to a BadgeTone — see the JSDoc mapping on BadgeProps. Rendered as a
// solid pill (tinted bg + matching text, no border). Long text stays on one
// line via whitespace-nowrap; truncation is the consumer's responsibility.

import { ReactNode } from 'react'

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'

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
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

const BASE_CLASSES =
  'inline-flex items-center ' +
  'px-2.5 py-0.5 ' +
  'rounded-full ' +
  'text-xs font-medium ' +
  'whitespace-nowrap'

// Tone hex values are fixed by the spec — do not swap for Tailwind aliases.
const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-[#f3f4f6] text-[#374151] dark:bg-[#21262d] dark:text-[#8b949e]',
  success: 'bg-[#dcfce7] text-[#166534] dark:bg-[#033a16] dark:text-[#3fb950]',
  warning: 'bg-[#fef3c7] text-[#854d0e] dark:bg-[#3a2e05] dark:text-[#d4a72c]',
  info: 'bg-[#dbeafe] text-[#1e40af] dark:bg-[#0c2d6b] dark:text-[#58a6ff]',
  danger: 'bg-[#fee2e2] text-[#931F1D] dark:bg-[#3d1513] dark:text-[#f85149]',
}

function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  const classes =
    BASE_CLASSES + ' ' + TONE_CLASSES[tone] + (className ? ' ' + className : '')

  return <span className={classes}>{children}</span>
}

export { Badge }
export default Badge
