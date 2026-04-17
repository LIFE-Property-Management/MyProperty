"use client";

import { useFormContext } from "react-hook-form";
import type { InvitePreview } from "../_lib/invite";
import type { WizardValues } from "../_lib/schema";

interface ReviewStepProps {
  invite: InvitePreview;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 md:flex-row md:items-baseline md:justify-between md:gap-4">
      <dt className="text-sm text-muted-text">{label}</dt>
      <dd className="text-sm font-medium text-primary-text">{value}</dd>
    </div>
  );
}

export function ReviewStep({ invite }: ReviewStepProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<WizardValues>();

  const rent = `€${invite.lease.monthlyRentEUR.toLocaleString()}`;
  const deposit = `€${invite.lease.depositEUR.toLocaleString()}`;
  const unit = invite.property.unit
    ? `${invite.property.address} — ${invite.property.unit}`
    : invite.property.address;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-heading text-xl text-primary-text">Review your lease</h2>
        <p className="mt-1 text-sm text-muted-text">
          You&apos;ve been invited by <strong>{invite.landlordName}</strong>. Review the details
          below, then accept on the next step.
        </p>
      </header>

      <dl className="divide-y divide-border rounded-md border border-border bg-surface p-4">
        <Row label="Property" value={unit} />
        <Row label="Lease start" value={formatDate(invite.lease.startDate)} />
        <Row label="Lease end" value={formatDate(invite.lease.endDate)} />
        <Row label="Monthly rent" value={rent} />
        <Row label="Security deposit" value={deposit} />
        <Row label="Invited email" value={invite.tenantEmail} />
        <Row label="Invite expires" value={formatDate(invite.expiresAt)} />
      </dl>

      <label className="flex items-start gap-3 text-sm text-primary-text">
        <input
          type="checkbox"
          {...register("acknowledgedLease")}
          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-primary"
          aria-invalid={errors.acknowledgedLease ? "true" : "false"}
        />
        <span>
          I have reviewed the lease terms above and understand that accepting this invite will bind
          me to these terms once confirmed by the landlord.
        </span>
      </label>
      {errors.acknowledgedLease && (
        <p className="text-sm text-danger" role="alert">
          {errors.acknowledgedLease.message}
        </p>
      )}
    </div>
  );
}
