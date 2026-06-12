"use client";

import { useState } from "react";
import Link from "next/link";
import DataTable, { type Column } from "@/components/ui/DataTable";
import Card from "@/components/ui/Card";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import Spinner from "@/components/ui/Spinner";
import { useLandlordInvites } from "@/lib/hooks/useLandlordInvites";
import { formatDate } from "@/lib/utils/formatDate";
import type { InviteListItem, InviteStatus } from "@/lib/types/landlord/invite";
import InviteRowActions from "./_components/InviteRowActions";

const PAGE_SIZE = 10;

const STATUS_TONE: Record<InviteStatus, BadgeTone> = {
  Pending: "info",
  Accepted: "success",
  Rejected: "danger",
  Expired: "neutral",
  Revoked: "neutral",
};

const FILTERS: (InviteStatus | "All")[] = [
  "All",
  "Pending",
  "Accepted",
  "Rejected",
  "Expired",
  "Revoked",
];

// Invitees are prospective tenants — no tenant account yet — so the name is
// plain text, not a tenant link (that rule is for actual tenants).
const columns: Column<InviteListItem>[] = [
  {
    key: "invitee",
    header: "Invitee",
    accessor: (row) => (
      <div className="flex flex-col">
        <span className="font-medium text-primary-text">
          {row.firstName} {row.lastName}
        </span>
        <span className="text-muted-text">{row.email}</span>
      </div>
    ),
  },
  {
    key: "property",
    header: "Property",
    accessor: (row) => (
      <Link
        href={`/dashboard/properties/${row.propertyId}`}
        className="text-primary font-medium hover:underline focus-visible:underline focus-visible:outline-none transition-colors duration-150"
      >
        {row.propertyName}
      </Link>
    ),
  },
  {
    key: "status",
    header: "Status",
    accessor: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>,
  },
  {
    key: "expires",
    header: "Expires",
    accessor: (row) => <span className="text-muted-text">{formatDate(row.expiresAt)}</span>,
  },
  {
    key: "sent",
    header: "Sent",
    accessor: (row) => <span className="text-muted-text">{formatDate(row.createdAt)}</span>,
  },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    accessor: (row) => <InviteRowActions invite={row} />,
  },
];

export default function InvitesPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<InviteStatus | "All">("All");
  const status = filter === "All" ? undefined : filter;
  const query = useLandlordInvites(page, PAGE_SIZE, status);

  if (query.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-medium">Failed to load invitations.</p>
        <p className="text-muted-text text-sm">Please refresh the page.</p>
      </div>
    );
  }

  const totalCount = query.data?.totalCount ?? 0;
  const items = query.data?.items ?? [];
  // Only the unfiltered, no-invites-at-all case shows the dedicated empty card.
  const isEmpty = !query.isLoading && filter === "All" && totalCount === 0;

  function selectFilter(next: InviteStatus | "All") {
    setFilter(next);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-primary-text">Invitations</h1>
        {!query.isLoading && totalCount > 0 && (
          <p className="text-sm text-muted-text mt-1 flex items-center gap-2">
            <span>
              {totalCount} invitation{totalCount === 1 ? "" : "s"}
              {filter !== "All" ? ` · ${filter}` : ""}
            </span>
            {query.isFetching && <Spinner size="sm" />}
          </p>
        )}
      </div>

      {isEmpty ? (
        <Card as="section" className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-primary-text font-medium">No invitations yet.</p>
          <p className="text-sm text-muted-text">
            Open a property and choose <span className="font-medium text-primary-text">Add lease</span> to invite a tenant.
          </p>
          <Link
            href="/dashboard/properties"
            className="mt-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors duration-150"
          >
            Go to Properties
          </Link>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => selectFilter(f)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  filter === f
                    ? "bg-primary text-white border-primary"
                    : "bg-surface text-primary-text border-border hover:bg-neutral-light"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <Card as="section" padding="none" className={query.isFetching ? "opacity-60 transition-opacity duration-150" : "transition-opacity duration-150"}>
            <DataTable
              columns={columns}
              data={items}
              isLoading={query.isLoading}
              getRowKey={(row) => row.id}
              emptyMessage={`No ${filter === "All" ? "" : filter.toLowerCase() + " "}invitations found.`}
              caption="Invitations list"
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
        </>
      )}
    </div>
  );
}
