"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import DataTable from "@/components/ui/DataTable";
import { useLandlordPropertyDetail } from "@/lib/hooks/useLandlordPropertyDetail";
import { useDeleteProperty } from "@/lib/hooks/useDeleteProperty";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";
import { formatDate } from "@/lib/utils/formatDate";
import type { PropertyTenant } from "@/lib/types/landlord/property";

const STATUS_TONE: Record<string, "success" | "neutral" | "danger"> = {
    Active: "success",
    Expired: "neutral",
    Terminated: "danger",
};

const TYPE_LABEL: Record<string, string> = {
    House: "🏠 House",
    Apartment: "🏢 Apartment",
    Commercial: "🏬 Commercial",
    Other: "📦 Other",
};

const tenantColumns = [
    {
        key: "name",
        header: "Tenant",
        accessor: (row: PropertyTenant) => (
            <Link
                href={`/dashboard/tenants/${row.tenantId}`}
                className="text-primary font-medium hover:underline focus-visible:underline focus-visible:outline-none transition-colors duration-150"
            >
                {row.fullName}
            </Link>
        ),
    },
    {
        key: "email",
        header: "Email",
        accessor: (row: PropertyTenant) => (
            <span className="text-muted-text">{row.email}</span>
        ),
    },
    {
        key: "lease",
        header: "Lease Period",
        accessor: (row: PropertyTenant) => (
            <span className="text-muted-text">
                {formatDate(row.leaseStart)} — {formatDate(row.leaseEnd)}
            </span>
        ),
    },
    {
        key: "rent",
        header: "Monthly Rent",
        accessor: (row: PropertyTenant) => (
            <span className="font-medium text-primary-text">
                {row.currency} {row.monthlyRent.toLocaleString()}
            </span>
        ),
    },
    {
        key: "status",
        header: "Status",
        accessor: (row: PropertyTenant) => (
            <Badge tone={STATUS_TONE[row.leaseStatus] ?? "neutral"}>
                {row.leaseStatus}
            </Badge>
        ),
    },
];

export default function PropertyDetailView({ propertyId }: { propertyId: string }) {
    const router = useRouter();
    const query = useLandlordPropertyDetail(propertyId);
    const deleteMutation = useDeleteProperty();
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

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
                <p className="text-danger font-medium">Failed to load property details.</p>
                <p className="text-muted-text text-sm">Please refresh the page.</p>
            </div>
        );
    }

    const p = query.data!;

    const handleDelete = async () => {
        setDeleteError(null);
        try {
            await deleteMutation.mutateAsync(propertyId);
            router.push("/dashboard/properties");
        } catch (err) {
            const detail =
                axios.isAxiosError(err) && typeof err.response?.data?.detail === "string"
                    ? err.response.data.detail
                    : "Could not delete this property. Please try again.";
            setDeleteError(detail);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Breadcrumb + Actions */}
            <div className="flex items-center justify-between">
                <Link
                    href="/dashboard/properties"
                    className="text-sm text-muted-text hover:text-primary-text transition-colors duration-150 focus-visible:outline-none focus-visible:underline"
                >
                    ← Properties
                </Link>
                <div className="flex gap-2">
                    <Link
                        href={`/dashboard/properties/${propertyId}/edit`}
                        className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-primary-text hover:bg-neutral-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-150"
                    >
                        Edit
                    </Link>
                    {!confirmDelete ? (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="px-4 py-2 rounded-lg border border-danger text-sm font-medium text-danger hover:bg-danger-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger transition-colors duration-150"
                        >
                            Delete
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-danger">Are you sure?</span>
                            <button
                                onClick={handleDelete}
                                disabled={deleteMutation.isPending}
                                className="px-4 py-2 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger focus-visible:outline-none transition-colors duration-150 disabled:opacity-60"
                            >
                                {deleteMutation.isPending ? "Deleting…" : "Yes, Delete"}
                            </button>
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-primary-text hover:bg-neutral-light focus-visible:outline-none transition-colors duration-150"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {deleteError && <p className="text-sm text-danger">{deleteError}</p>}

            <div>
                <h1 className="text-xl font-semibold text-primary-text">{p.name}</h1>
                <p className="text-sm text-muted-text mt-1">
                    {p.address}{p.unitNumber ? `, Unit ${p.unitNumber}` : ""}
                </p>
            </div>

            <Card as="section">
                <h2 className="text-sm font-medium text-muted-text mb-4">Property info</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-muted-text mb-1">Type</p>
                        <p className="text-sm text-primary-text">{TYPE_LABEL[p.propertyType] ?? p.propertyType}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-text mb-1">Address</p>
                        <p className="text-sm text-primary-text">{p.address}</p>
                    </div>
                    {p.unitNumber && (
                        <div>
                            <p className="text-xs text-muted-text mb-1">Unit</p>
                            <p className="text-sm text-primary-text">{p.unitNumber}</p>
                        </div>
                    )}
                    <div>
                        <p className="text-xs text-muted-text mb-1">Added</p>
                        <p className="text-sm text-primary-text">{formatDate(p.createdAt)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-text mb-1">Status</p>
                        <Badge tone={p.tenants.some(t => t.leaseStatus === "Active") ? "success" : "neutral"}>
                            {p.tenants.some(t => t.leaseStatus === "Active") ? "Occupied" : "Vacant"}
                        </Badge>
                    </div>
                    <div>
                        <p className="text-xs text-muted-text mb-1">Active tenants</p>
                        <p className="text-sm font-medium text-primary-text">
                            {p.tenants.filter(t => t.leaseStatus === "Active").length}
                        </p>
                    </div>
                </div>
            </Card>

            <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-primary-text">Tenants</h2>
                        <p className="text-sm text-muted-text mt-1">
                            {p.tenants.length} lease{p.tenants.length === 1 ? "" : "s"} on this property
                        </p>
                    </div>
                    {/* ⚠️ PLACEHOLDER LINK — the invite-CREATION flow does not exist yet (the
                        /dashboard/invites page is currently a stub, and there is no
                        /dashboard/properties/[id]/invite route). This points at the invites list so the
                        button doesn't 404. Repoint this at the real "new invite" route, ideally prefilled
                        with propertyId={propertyId}, once that flow is built. DO NOT ship the invite button
                        as a primary CTA without revisiting this. */}
                    <Link
                        href="/dashboard/invites"
                        // Landlord activation funnel — step 4 (intent to invite). This is
                        // the last measurable step until the invite-creation flow ships and
                        // can fire ANALYTICS_EVENTS.tenantInvited. See events.ts.
                        onClick={() =>
                            capture(ANALYTICS_EVENTS.tenantInviteStarted, { propertyId })
                        }
                        className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-150"
                    >
                        Invite Tenant
                    </Link>
                </div>
                <Card padding="none">
                    <DataTable
                        columns={tenantColumns}
                        data={p.tenants}
                        getRowKey={(row) => row.tenantId}
                        emptyMessage="No tenants yet."
                        caption="Property tenants"
                    />
                </Card>
            </section>
        </div>
    );
}
