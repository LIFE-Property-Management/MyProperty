"use client";

import { useState } from "react";
import Link from "next/link";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import Spinner from "@/components/ui/Spinner";
import { useLandlordDashboard } from "@/lib/hooks/useLandlordDashboard";
import { useLandlordUpcomingPayments } from "@/lib/hooks/useLandlordUpcomingPayments";
import { formatDate } from "@/lib/utils/formatDate";
import type {
    OverduePaymentRow,
    ExpiringLeaseRow,
    RecentPaymentRow,
    UpcomingPaymentRow,
} from "@/lib/types/landlord/dashboard";
import type { PaymentMethod } from "@/lib/types/enums";

const PAGE_SIZE = 10;

const METHOD_LABEL: Record<PaymentMethod, string> = {
    ReceiptUpload: "Digital",
    ManualRequest: "Cash",
};

function TenantLink({ tenantId, name }: { tenantId: string; name: string }) {
    return (
        <Link
            href={`/dashboard/tenants/${tenantId}`}
            className="text-primary hover:underline focus-visible:underline focus-visible:outline-none transition-colors duration-150"
        >
            {name}
        </Link>
    );
}

const overdueColumns = [
    {
        key: "tenant",
        header: "Tenant",
        accessor: (row: OverduePaymentRow) => (
            <TenantLink tenantId={row.tenantId} name={row.tenantName} />
        ),
    },
    {
        key: "property",
        header: "Property",
        accessor: (row: OverduePaymentRow) => (
            <span className="text-muted-text">{row.property}</span>
        ),
    },
    {
        key: "amount",
        header: "Amount",
        accessor: (row: OverduePaymentRow) => `${row.currency} ${row.amount}`,
    },
    {
        key: "daysOverdue",
        header: "Days Overdue",
        accessor: (row: OverduePaymentRow) => (
            <Badge tone={row.daysOverdue >= 10 ? "danger" : "warning"}>
                {row.daysOverdue} {row.daysOverdue === 1 ? "day" : "days"}
            </Badge>
        ),
    },
];

const expiringColumns = [
    {
        key: "tenant",
        header: "Tenant",
        accessor: (row: ExpiringLeaseRow) => (
            <TenantLink tenantId={row.tenantId} name={row.tenantName} />
        ),
    },
    {
        key: "property",
        header: "Property",
        accessor: (row: ExpiringLeaseRow) => (
            <span className="text-muted-text">{row.property}</span>
        ),
    },
    {
        key: "leaseEndDate",
        header: "Lease End Date",
        accessor: (row: ExpiringLeaseRow) => formatDate(row.leaseEndDate),
    },
    {
        key: "daysRemaining",
        header: "Days Remaining",
        accessor: (row: ExpiringLeaseRow) => (
            <Badge tone={row.daysRemaining <= 14 ? "danger" : "warning"}>
                {row.daysRemaining} {row.daysRemaining === 1 ? "day" : "days"}
            </Badge>
        ),
    },
];

const recentColumns = [
    {
        key: "tenant",
        header: "Tenant",
        accessor: (row: RecentPaymentRow) => (
            <TenantLink tenantId={row.tenantId} name={row.tenantName} />
        ),
    },
    {
        key: "property",
        header: "Property",
        accessor: (row: RecentPaymentRow) => (
            <span className="text-muted-text">{row.property}</span>
        ),
    },
    {
        key: "amount",
        header: "Amount",
        accessor: (row: RecentPaymentRow) => `${row.currency} ${row.amount}`,
    },
    {
        key: "method",
        header: "Method",
        accessor: (row: RecentPaymentRow) => (
            <Badge tone={row.method === "ReceiptUpload" ? "success" : "neutral"}>
                {METHOD_LABEL[row.method]}
            </Badge>
        ),
    },
    {
        key: "datePaid",
        header: "Date Paid",
        accessor: (row: RecentPaymentRow) => (
            <span className="text-muted-text">{formatDate(row.datePaid)}</span>
        ),
    },
];

const upcomingColumns = [
    {
        key: "tenant",
        header: "Tenant",
        accessor: (row: UpcomingPaymentRow) => (
            <TenantLink tenantId={row.tenantId} name={row.tenantName} />
        ),
    },
    {
        key: "property",
        header: "Property",
        accessor: (row: UpcomingPaymentRow) => (
            <span className="text-muted-text">{row.property}</span>
        ),
    },
    {
        key: "amount",
        header: "Amount",
        accessor: (row: UpcomingPaymentRow) => `${row.currency} ${row.amount}`,
    },
    {
        key: "dueDate",
        header: "Due Date",
        accessor: (row: UpcomingPaymentRow) => (
            <span className="text-muted-text">{formatDate(row.dueDate)}</span>
        ),
    },
];

export default function LandlordDashboard() {
    const [page, setPage] = useState(1);
    const dashboardQuery = useLandlordDashboard();
    const upcomingQuery = useLandlordUpcomingPayments(page, PAGE_SIZE);

    if (dashboardQuery.isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Spinner size="lg" />
            </div>
        );
    }

    // TODO M3: Replace whole-page error with per-section error states for better UX
    if (dashboardQuery.isError || upcomingQuery.isError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-danger font-medium">Failed to load dashboard data.</p>
                <p className="text-muted-text text-sm">Please refresh the page.</p>
            </div>
        );
    }

    const { stats, overduePayments, expiringLeases, recentPayments } =
        dashboardQuery.data!;

    return (
        <div className="flex flex-col gap-8">
            {/* Overview */}
            <Card as="section">
                <h2 className="text-sm font-medium text-muted-text mb-4">Overview</h2>
                <div className="flex gap-4 flex-wrap">
                    <div className="bg-surface border border-border rounded-xl p-6 flex-1 min-w-40">
                        <p className="text-sm text-muted-text mb-2">Total properties</p>
                        <p className="text-4xl font-semibold text-primary-text">{stats.totalProperties}</p>
                    </div>
                    <div className="bg-surface border border-border rounded-xl p-6 flex-1 min-w-40">
                        <p className="text-sm text-muted-text mb-2">Total active tenants</p>
                        <p className="text-4xl font-semibold text-primary-text">{stats.totalActiveTenants}</p>
                    </div>
                </div>
            </Card>

            {/* Overdue Payments */}
            <section className="flex flex-col gap-4">
                <div>
                    <h2 className="text-base font-semibold text-primary-text">Overdue payments</h2>
                    {overduePayments.length > 0 && (
                        <p className="text-sm text-muted-text mt-1">
                            {overduePayments.length} tenant{overduePayments.length > 1 ? "s" : ""} with outstanding rent
                        </p>
                    )}
                </div>
                <DataTable
                    columns={overdueColumns}
                    data={overduePayments}
                    getRowKey={(row) => row.id}
                    emptyMessage="All tenants are paid up."
                />
            </section>

            {/* Expiring Leases */}
            <section className="flex flex-col gap-4">
                <div>
                    <h2 className="text-base font-semibold text-primary-text">Leases expiring soon</h2>
                    <p className="text-sm text-muted-text mt-1">Leases ending within the next 30 days</p>
                </div>
                <DataTable
                    columns={expiringColumns}
                    data={expiringLeases}
                    getRowKey={(row) => row.id}
                    emptyMessage="No leases expiring soon."
                />
            </section>

            {/* Recent Payments */}
            <section className="flex flex-col gap-4">
                <div>
                    <h2 className="text-base font-semibold text-primary-text">Recent payments</h2>
                    <p className="text-sm text-muted-text mt-1">Last 5 payments across all properties</p>
                </div>
                <DataTable
                    columns={recentColumns}
                    data={recentPayments}
                    getRowKey={(row) => row.id}
                    emptyMessage="No recent payments."
                />
            </section>

            {/* Upcoming Payments */}
            <section className="flex flex-col gap-4">
                <div>
                    <h2 className="text-base font-semibold text-primary-text">Upcoming payments</h2>
                    <p className="text-sm text-muted-text mt-1">All payments due in the next 30 days</p>
                </div>
                <DataTable
                    columns={upcomingColumns}
                    data={upcomingQuery.data?.items ?? []}
                    isLoading={upcomingQuery.isLoading}
                    getRowKey={(row) => row.id}
                    emptyMessage="No upcoming payments."
                />
                <Pagination
                    page={page}
                    totalCount={upcomingQuery.data?.totalCount ?? 0}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                />
            </section>
        </div>
    );
}
