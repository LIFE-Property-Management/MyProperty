'use client'

import { useAuth } from '@/lib/hooks'

export function ReadOnlyBanner() {
  const { isReadOnly, isMeLoading } = useAuth()

  if (isMeLoading) return null
  if (!isReadOnly) return null

  return (
      <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-muted-text)] dark:bg-[var(--color-surface)]"
      >
        Your account is in read-only mode. Contact your landlord for assistance.
      </div>
  )
}
