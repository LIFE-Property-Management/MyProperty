// Paginated payment history with client-side status filter. The filter applies only to the
// current page's items — full server-side filtering is out of scope for Phase 2.
// usePaymentHistory uses keepPreviousData so stale rows stay visible during page transitions.
'use client';

import { useState, useMemo } from 'react';
import { Card } from './ui/Card';
import { DataTable, type Column } from './ui/DataTable';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { usePaymentHistory } from '@/lib/hooks';
import type { PaymentHistoryEntry, PaymentStatus } from '@/lib/types';

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

const PAGE_SIZE = 10;

const columns: Column<PaymentHistoryEntry>[] = [
  {
    key: 'dueDate',
    header: 'Due Date',
    accessor: (row) => formatDate(row.dueDate),
  },
  {
    key: 'amount',
    header: 'Amount',
    accessor: (row) => formatCurrency(row.amount, row.currency),
    align: 'right',
  },
  {
    key: 'status',
    header: 'Status',
    accessor: (row) => <Badge tone={toneFor(row.status)}>{row.status}</Badge>,
  },
  {
    key: 'method',
    header: 'Method',
    accessor: (row) =>
      row.method === 'ReceiptUpload'
        ? 'Receipt Upload'
        : row.method === 'ManualRequest'
          ? 'Manual Request'
          : '—',
  },
  {
    key: 'submittedAt',
    header: 'Submitted',
    accessor: (row) => (row.submittedAt ? formatDateTime(row.submittedAt) : '—'),
  },
  {
    key: 'confirmedAt',
    header: 'Confirmed',
    accessor: (row) => (row.confirmedAt ? formatDateTime(row.confirmedAt) : '—'),
  },
];

export function PaymentHistoryTable() {
  const [page, setPage] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'All'>('All');
  const { data, isLoading, isError, isFetching } = usePaymentHistory(page, PAGE_SIZE);

  // Client-side filter on current page only — not a substitute for server-side filtering.
  const filteredItems: PaymentHistoryEntry[] = useMemo(() => {
    if (!data) return [];
    if (statusFilter === 'All') return data.items;
    return data.items.filter((item) => item.status === statusFilter);
  }, [data, statusFilter]);

  const totalPages: number = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  return (
    <Card padding="lg" animateOnMount>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#111111] dark:text-[#f0f6fc]">
          Payment History
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="font-sans text-sm font-medium text-[#111111] dark:text-[#f0f6fc] whitespace-nowrap">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as PaymentStatus | 'All');
              setPage(1);
            }}
            className="font-sans text-sm rounded-md border border-[#e5e7eb] dark:border-[#30363d]
                       bg-[#ffffff] dark:bg-[#161b22]
                       text-[#111111] dark:text-[#f0f6fc]
                       px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#275D2C] dark:focus:ring-[#3fb950]"
          >
            <option value="All">All statuses</option>
            <option value="Outstanding">Outstanding</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {isError ? (
        <p className="mt-6 text-sm font-sans text-[#931F1D] dark:text-[#f85149]">
          Could not load payment history. Please refresh the page.
        </p>
      ) : (
        <div className="mt-6">
          <DataTable<PaymentHistoryEntry>
            columns={columns}
            data={filteredItems}
            isLoading={isLoading}
            emptyMessage={
              statusFilter === 'All'
                ? 'No payments yet.'
                : `No payments match the "${statusFilter}" filter on this page.`
            }
            getRowKey={(row) => row.id}
            caption="Payment history"
          />
        </div>
      )}

      {!isError && !isLoading && data && (
        <div className="mt-6 flex items-center justify-between">
          <p className="font-sans text-sm text-[#6b7280] dark:text-[#8b949e]">
            Page {data.page} of {totalPages}
            {isFetching && ' · Updating…'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              aria-label={`Previous page, currently on page ${data.page} of ${totalPages}`}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
              aria-label={`Next page, currently on page ${data.page} of ${totalPages}`}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
