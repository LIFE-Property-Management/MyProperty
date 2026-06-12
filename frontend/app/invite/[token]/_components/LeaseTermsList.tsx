import type { InvitePreview } from "../_lib/invite";

interface LeaseTermsListProps {
  invite: InvitePreview;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRent(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 md:flex-row md:items-baseline md:justify-between md:gap-4">
      <dt className="text-sm text-muted-text">{label}</dt>
      <dd className="text-sm font-medium text-primary-text">{value}</dd>
    </div>
  );
}

// Read-only summary of the proposed lease terms from the invite preview. Shared
// by the new-user review step and the returning-tenant claim confirmation.
export function LeaseTermsList({ invite }: LeaseTermsListProps) {
  const property = invite.propertyName
    ? `${invite.propertyName} — ${invite.propertyAddress}`
    : invite.propertyAddress;

  return (
    <dl className="divide-y divide-border rounded-md border border-border bg-surface p-4">
      <Row label="Property" value={property} />
      <Row label="Lease start" value={formatDate(invite.proposedStartDate)} />
      <Row label="Lease end" value={formatDate(invite.proposedEndDate)} />
      <Row label="Monthly rent" value={formatRent(invite.proposedMonthlyRent, invite.currency)} />
      <Row label="Invited email" value={invite.tenantEmail} />
      <Row label="Invite expires" value={formatDate(invite.expiresAt)} />
    </dl>
  );
}
