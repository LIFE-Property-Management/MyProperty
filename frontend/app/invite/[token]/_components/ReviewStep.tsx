"use client";

import { useFormContext } from "react-hook-form";
import type { InvitePreview } from "../_lib/invite";
import type { WizardValues } from "../_lib/schema";
import { LeaseTermsList } from "./LeaseTermsList";

interface ReviewStepProps {
  invite: InvitePreview;
}

export function ReviewStep({ invite }: ReviewStepProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<WizardValues>();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-heading text-xl text-primary-text">Review your lease</h2>
        <p className="mt-1 text-sm text-muted-text">
          You&apos;ve been invited by <strong>{invite.landlordFullName}</strong>. Review the details
          below, then accept on the next step.
        </p>
      </header>

      <LeaseTermsList invite={invite} />

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
