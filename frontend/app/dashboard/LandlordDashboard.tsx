"use client";

import { useState } from "react";
import Link from "next/link";
import DataTable from "@/components/ui/DataTable";
import Card from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import Spinner from "@/components/ui/Spinner";
import { useLandlordDashboard } from "@/lib/hooks/useLandlordDashboard";
import { useLandlordUpcomingPayments } from "@/lib/hooks/useLandlordUpcomingPayments";
import { formatDate } from "@/lib/utils/formatDate";
import type { UpcomingPaymentRow } from "@/lib/types/landlord/dashboard";

const PAGE_SIZE = 10;

const upcomingColumns = [
    {
        key: "tenant",
        header: "Tenant",
        accessor: (row: UpcomingPaymentRow) => (
            <Link
                href={`/dashboard/tenants/${row.tenantId}`}
                className="text-primary hover:underline focus-visible:underline focus-visible:outline-none transition-colors duration-150"
            >
                {row.tenantName}
            </Link>
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

    if (dashboardQuery.isError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-danger font-medium">Failed to load dashboard data.</p>
                <p className="text-muted-text text-sm">Please refresh the page.</p>
            </div>
        );
    }

    const data = dashboardQuery.data!;

    return (
        <div className="flex flex-col gap-8">
            {/* Overview */}
            <Card as="section">
                <h2 className="text-sm font-medium text-muted-text mb-4">Overview</h2>
                <div className="flex gap-4 flex-wrap">
                    <div className="bg-surface border border-border rounded-xl p-6 flex-1 min-w-40">
                        <p className="text-sm text-muted-text mb-2">Total properties</p>
                        <p className="text-4xl font-semibold text-primary-text">{data.totalProperties}</p>
                    </div>
                    <div className="bg-surface border border-border rounded-xl p-6 flex-1 min-w-40">
                        <p className="text-sm text-muted-text mb-2">Active tenants</p>
                        <p className="text-4xl font-semibold text-primary-text">{data.activeTenants}</p>
                    </div>
                    <div className="bg-surface border border-border rounded-xl p-6 flex-1 min-w-40">
                        <p className="text-sm text-muted-text mb-2">Active leases</p>
                        <p className="text-4xl font-semibold text-primary-text">{data.activeLeases}</p>
                    </div>
                    <div className="bg-surface border border-border rounded-xl p-6 flex-1 min-w-40">
                        <p className="text-sm text-muted-text mb-2">Overdue payments</p>
                        <p className={`text-4xl font-semibold ${data.overduePayments > 0 ? "text-danger" : "text-primary-text"}`}>
                            {data.overduePayments}
                        </p>
                    </div>
                    <div className="bg-surface border border-border rounded-xl p-6 flex-1 min-w-40">
                        <p className="text-sm text-muted-text mb-2">Pending payments</p>
                        <p className="text-4xl font-semibold text-primary-text">{data.pendingPayments}</p>
                    </div>
                </div>
            </Card>

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
