"use client";

import Link from "next/link";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { useLandlordTenantDetail } from "@/lib/hooks/useLandlordTenantDetail";
import { formatDate } from "@/lib/utils/formatDate";
import type { PaymentHistoryItem } from "@/lib/types/landlord/tenant";
import type { LeaseStatus, PaymentStatus } from "@/lib/types/enums";

const LEASE_STATUS_TONE: Record<LeaseStatus, "success" | "neutral" | "danger"> = {
    Active: "success",
    Expired: "neutral",
    Terminated: "danger",
};

const PAYMENT_STATUS_TONE: Record<PaymentStatus, "warning" | "info" | "success" | "danger"> = {
    Outstanding: "warning",
    Pending: "info",
    Confirmed: "success",
    Rejected: "danger",
};

const paymentColumns = [
    {
        key: "dueDate",
        header: "Due Date",
        accessor: (row: PaymentHistoryItem) => formatDate(row.dueDate),
    },
    {
        key: "amount",
        header: "Amount",
        align: "right" as const,
        accessor: (row: PaymentHistoryItem) =>
            `${row.currency} ${row.amount.toLocaleString()}`,
    },
    {
        key: "status",
        header: "Status",
        accessor: (row: PaymentHistoryItem) => (
            <Badge tone={PAYMENT_STATUS_TONE[row.status]}>{row.status}</Badge>
        ),
    },
    {
        key: "submittedAt",
        header: "Submitted",
        accessor: (row: PaymentHistoryItem) =>
            row.submittedAt ? (
                <span className="text-muted-text">{formatDate(row.submittedAt)}</span>
            ) : (
                <span className="text-muted-text">—</span>
            ),
    },
];

export default function TenantDetailView({ tenantId }: { tenantId: string }) {
    const query = useLandlordTenantDetail(tenantId);

    if (query.isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner size="lg" />
            </div>
        );
    }

    if (query.isError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-danger font-medium">Failed to load tenant details.</p>
                <p className="text-muted-text text-sm">Please refresh the page.</p>
            </div>
        );
    }

    const t = query.data!;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
                <Link
                    href="/dashboard/tenants"
                    className="text-sm text-muted-text hover:text-primary-text transition-colors duration-150 focus-visible:outline-none focus-visible:underline"
                >
                    ← Tenants
                </Link>
            </div>

            <div>
                <h1 className="text-xl font-semibold text-primary-text">{t.fullName}</h1>
                <p className="text-sm text-muted-text mt-1">{t.email}</p>
            </div>

            {/* Summary card */}
            <Card as="section">
                <h2 className="text-sm font-medium text-muted-text mb-4">Lease summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-muted-text mb-1">Property</p>
                        <p className="text-sm font-medium text-primary-text">{t.propertyName}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-text mb-1">Status</p>
                        <Badge tone={LEASE_STATUS_TONE[t.leaseStatus]}>{t.leaseStatus}</Badge>
                    </div>
                    <div>
                        <p className="text-xs text-muted-text mb-1">Lease period</p>
                        <p className="text-sm text-primary-text">
                            {formatDate(t.leaseStartDate)} — {formatDate(t.leaseEndDate)}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-text mb-1">Monthly rent</p>
                        <p className="text-sm font-medium text-primary-text">
                            {t.currency} {t.monthlyRent.toLocaleString()}
                        </p>
                    </div>
                </div>
            </Card>

            {/* Payment history */}
            <section className="flex flex-col gap-4">
                <div>
                    <h2 className="text-base font-semibold text-primary-text">Payment history</h2>
                    <p className="text-sm text-muted-text mt-1">
                        {t.paymentHistory.length} payment{t.paymentHistory.length === 1 ? "" : "s"}
                    </p>
                </div>
                <Card padding="none">
                    <DataTable
                        columns={paymentColumns}
                        data={t.paymentHistory}
                        getRowKey={(row) => row.id}
                        emptyMessage="No payment history."
                        caption="Payment history"
                    />
                </Card>
            </section>
        </div>
    );
}
