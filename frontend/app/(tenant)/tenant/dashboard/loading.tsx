export default function DashboardLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:px-8 space-y-6">
      {/* Page heading skeleton */}
      <div className="animate-pulse rounded-lg bg-[var(--color-border)] h-9 w-48" />

      {/* LeaseSummaryCard skeleton */}
      <div className="animate-pulse rounded-xl bg-[var(--color-border)] h-[120px]" />

      {/* PaymentSection skeleton */}
      <div className="animate-pulse rounded-xl bg-[var(--color-border)] h-[200px]" />

      {/* PaymentHistoryTable skeleton */}
      <div className="animate-pulse rounded-xl bg-[var(--color-border)] h-[300px]" />
    </div>
  )
}
