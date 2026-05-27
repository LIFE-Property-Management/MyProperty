"use client";

import { useState } from "react";
import Link from "next/link";
import DataTable from "@/components/ui/DataTable";
import Card from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import Spinner from "@/components/ui/Spinner";
import { useLandlordProperties } from "@/lib/hooks/useLandlordProperties";
import { formatDate } from "@/lib/utils/formatDate";
import type { PropertyRow } from "@/lib/types/landlord/property";

const PAGE_SIZE = 10;

const columns = [
    {
        key: "name",
        header: "Name",
        accessor: (row: PropertyRow) => (
            <Link
                href={`/dashboard/properties/${row.id}`}
                className="text-primary font-medium hover:underline focus-visible:underline focus-visible:outline-none transition-colors duration-150"
            >
                {row.name}
            </Link>
        ),
    },
    {
        key: "address",
        header: "Address",
        accessor: (row: PropertyRow) => (
            <span className="text-muted-text">
                {row.address}
                {row.unitNumber ? `, Unit ${row.unitNumber}` : ""}
            </span>
        ),
    },
    {
        key: "createdAt",
        header: "Added",
        accessor: (row: PropertyRow) => (
            <span className="text-muted-text">{formatDate(row.createdAt)}</span>
        ),
    },
];

export default function PropertiesPage() {
    const [page, setPage] = useState(1);
    const query = useLandlordProperties(page, PAGE_SIZE);

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
                <p className="text-danger font-medium">Failed to load properties.</p>
                <p className="text-muted-text text-sm">Please refresh the page.</p>
            </div>
        );
    }

    const totalCount = query.data?.totalCount ?? 0;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-xl font-semibold text-primary-text">Properties</h1>
                {totalCount > 0 && (
                    <p className="text-sm text-muted-text mt-1">
                        {totalCount} propert{totalCount === 1 ? "y" : "ies"}
                    </p>
                )}
            </div>

            <Card as="section" padding="none">
                <DataTable
                    columns={columns}
                    data={query.data?.items ?? []}
                    isLoading={query.isLoading}
                    getRowKey={(row) => row.id}
                    emptyMessage="No properties found."
                    caption="Properties list"
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
