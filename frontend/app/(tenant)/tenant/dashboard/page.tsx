import { PageTransition } from '../../_components/PageTransition'
import { ReadOnlyBanner } from '../../_components/ReadOnlyBanner'
import { LeaseSummarySection } from '../../_components/LeaseSummarySection'
import { PaymentSection } from '../../_components/PaymentSection'
import { PaymentHistoryTable } from '../../_components/PaymentHistoryTable'

export default function TenantDashboardPage() {
  return (
      <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
        <PageTransition>
          <div className="max-w-4xl mx-auto px-4 py-8 md:px-8 space-y-6">
              <h1 className="text-2xl md:text-3xl text-[var(--color-primary-text)]">
              My Dashboard
              </h1>

            <ReadOnlyBanner />

            <LeaseSummarySection />

            <PaymentSection />

            <PaymentHistoryTable />
          </div>
        </PageTransition>
      </main>
    
  )
}
