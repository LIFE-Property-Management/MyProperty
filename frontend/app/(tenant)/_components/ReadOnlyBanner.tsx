'use client'

import useTenantStore from '@/lib/store/useTenantStore'

export function ReadOnlyBanner() {
  const isReadOnly = useTenantStore((s) => s.isReadOnly)

  if (!isReadOnly) return null

  return (
    <div
      role="alert"
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-muted-text)] dark:bg-[var(--color-surface)]"
    >
      Your account is in read-only mode. Contact your landlord for assistance.
    </div>
  )
}
