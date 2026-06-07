"use client";

import { useState } from "react";
import Link from "next/link";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import Spinner from "@/components/ui/Spinner";
import { useLandlordTenants } from "@/lib/hooks/useLandlordTenants";
import { formatDate } from "@/lib/utils/formatDate";
import type { LandlordTenantRow } from "@/lib/types/landlord/tenant";
import type { LeaseStatus } from "@/lib/types/enums";

const PAGE_SIZE = 10;

const LEASE_STATUS_TONE: Record<LeaseStatus, "success" | "neutral" | "danger"> = {
    Active: "success",
    Expired: "neutral",
    Terminated: "danger",
};

const columns = [
    {
        key: "name",
        header: "Tenant",
        accessor: (row: LandlordTenantRow) => (
            <Link
                href={`/dashboard/tenants/${row.tenantId}`}
                className="text-primary font-medium hover:underline focus-visible:underline focus-visible:outline-none transition-colors duration-150"
            >
                {row.firstName} {row.lastName}
            </Link>
        ),
    },
    {
        key: "email",
        header: "Email",
        accessor: (row: LandlordTenantRow) => (
            <span className="text-muted-text">{row.email}</span>
        ),
    },
    {
        key: "property",
        header: "Property",
        accessor: (row: LandlordTenantRow) => (
            <span className="text-muted-text">{row.propertyName}</span>
        ),
    },
    {
        key: "leaseEnd",
        header: "Lease End",
        accessor: (row: LandlordTenantRow) => (
            <span className="text-muted-text">{formatDate(row.leaseEndDate)}</span>
        ),
    },
    {
        key: "status",
        header: "Status",
        accessor: (row: LandlordTenantRow) => (
            <Badge tone={LEASE_STATUS_TONE[row.leaseStatus]}>{row.leaseStatus}</Badge>
        ),
    },
];

export default function TenantsPage() {
    const [page, setPage] = useState(1);
    const query = useLandlordTenants(page, PAGE_SIZE);

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
                <p className="text-danger font-medium">Failed to load tenants.</p>
                <p className="text-muted-text text-sm">Please refresh the page.</p>
            </div>
        );
    }

    const totalCount = query.data?.totalCount ?? 0;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-xl font-semibold text-primary-text">Tenants</h1>
                {totalCount > 0 && (
                    <p className="text-sm text-muted-text mt-1">
                        {totalCount} tenant{totalCount === 1 ? "" : "s"}
                    </p>
                )}
            </div>

            <Card as="section" padding="none">
                <DataTable
                    columns={columns}
                    data={query.data?.items ?? []}
                    isLoading={query.isLoading}
                    getRowKey={(row) => row.tenantId}
                    emptyMessage="No tenants found."
                    caption="Tenants list"
                />
                {totalCount > PAGE_SIZE && (
                    <div className="px-4 py-3 border-t border-border">
                        <Pagination
                            page={page}
                            totalCount={totalCount}
                            pageSize={PAGE_SIZE}
                            onPageChange={setPage}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
}
