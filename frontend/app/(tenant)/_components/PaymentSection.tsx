// Current-payment state machine. Renders different UI per PaymentStatus and polls via
// useCurrentPayment (30s refetchInterval). Rejected is treated identically to Outstanding
// for action buttons — the backend issues a new payment id on resubmission, so this
// component always operates on the current payment's id without reuse logic.
'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from './ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useCurrentPayment } from '@/lib/hooks';
import useTenantStore from '@/lib/store/useTenantStore';
import type { PaymentStatus } from '@/lib/types';

const locale =
  typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

// Exhaustive switch — TS strict will surface a missing case if PaymentStatus is extended.
function toneFor(status: PaymentStatus): 'warning' | 'info' | 'success' | 'danger' {
  switch (status) {
    case 'Outstanding':
      return 'warning';
    case 'Pending':
      return 'info';
    case 'Confirmed':
      return 'success';
    case 'Rejected':
      return 'danger';
  }
}

export function PaymentSection() {
  // Separate selectors preserve Zustand's shallow-compare optimization.
  const isReadOnly = useTenantStore((s) => s.isReadOnly);
  const openModal = useTenantStore((s) => s.openModal);
  const { data: payment, isLoading, isError } = useCurrentPayment();

  function renderActionButtons(paymentId: string) {
    if (isReadOnly) return null;
    return (
      <div className="mt-6 flex flex-col md:flex-row gap-3">
        <Button
          variant="primary"
          size="md"
          onClick={() => openModal('receiptUpload', paymentId)}
          fullWidth
        >
          Upload Receipt
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => openModal('manualRequest', paymentId)}
          fullWidth
        >
          Request Manual Confirmation
        </Button>
      </div>
    );
  }

  function renderBody() {
    if (isLoading) {
      return (
        <div className="min-h-[160px] flex items-center justify-center">
          <Spinner size="md" />
        </div>
      );
    }

    if (isError || !payment) {
      return (
        <p className="mt-4 text-sm font-sans text-[#931F1D] dark:text-[#f85149]">
          Could not load current payment. Please refresh the page.
        </p>
      );
    }

    switch (payment.status) {
      case 'Outstanding':
        return (
          <>
            <div className="mt-6">
              <p className="font-sans text-sm text-[#6b7280] dark:text-[#8b949e] uppercase tracking-wide">
                Amount Due
              </p>
              <p className="mt-1 font-serif text-4xl md:text-5xl font-bold text-[#111111] dark:text-[#f0f6fc]">
                {formatCurrency(payment.amount, payment.currency)}
              </p>
              <p className="mt-2 font-sans text-sm text-[#6b7280] dark:text-[#8b949e]">
                Due {formatDate(payment.dueDate)}
              </p>
            </div>
            {renderActionButtons(payment.id)}
          </>
        );

      case 'Pending':
        return (
          <div className="mt-6">
            <p className="font-sans text-sm text-[#6b7280] dark:text-[#8b949e]">
              Submitted {payment.submittedAt ? formatDateTime(payment.submittedAt) : '—'}
            </p>
            <p className="mt-3 font-sans text-base text-[#111111] dark:text-[#f0f6fc]">
              Awaiting landlord confirmation.
            </p>
          </div>
        );

      case 'Confirmed':
        return (
          <div className="mt-6">
            <p className="font-sans text-sm text-[#6b7280] dark:text-[#8b949e]">
              Confirmed {payment.confirmedAt ? formatDateTime(payment.confirmedAt) : '—'}
            </p>
            <p className="mt-3 font-sans text-base text-[#275D2C] dark:text-[#3fb950] font-medium">
              Payment confirmed. Thank you.
            </p>
          </div>
        );

      case 'Rejected':
        return (
          <>
            <div className="mt-6">
              <p className="font-sans text-sm text-[#6b7280] dark:text-[#8b949e]">
                Rejected {payment.rejectedAt ? formatDateTime(payment.rejectedAt) : '—'}
              </p>
              {payment.rejectionReason && (
                <p className="mt-3 font-sans text-sm text-[#931F1D] dark:text-[#f85149]">
                  Reason: {payment.rejectionReason}
                </p>
              )}
              <p className="mt-3 font-sans text-base text-[#111111] dark:text-[#f0f6fc]">
                You can resubmit your payment below.
              </p>
            </div>
            {renderActionButtons(payment.id)}
          </>
        );
    }
  }

  return (
    <Card padding="lg">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] dark:text-[#f0f6fc]">
          Current Payment
        </h2>
        {payment && <Badge tone={toneFor(payment.status)}>{payment.status}</Badge>}
      </div>
      {renderBody()}
    </Card>
  );
}
