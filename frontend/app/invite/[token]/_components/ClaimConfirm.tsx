// Returning-tenant claim path: the visitor is already signed in and their email
// matches the invite, so there's no account step — just review the terms and
// confirm. Submits the authenticated claim, which creates the lease and redirects
// to the tenant dashboard (handled in useClaimInvite).
"use client";

import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { InvitePreview } from "../_lib/invite";
import { useClaimInvite } from "../_lib/useClaimInvite";
import { LeaseTermsList } from "./LeaseTermsList";
import { EmailMismatchView } from "./EmailMismatchView";

interface ClaimConfirmProps {
  invite: InvitePreview;
  token: string;
}

export function ClaimConfirm({ invite, token }: ClaimConfirmProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [ackError, setAckError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailMismatch, setEmailMismatch] = useState(false);
  const { mutateAsync, isPending } = useClaimInvite();

  // 403 means the JWT email differs from the invite email (a race or a stale
  // session): the client pre-check in InviteWizard normally catches this, but the
  // server is authoritative — surface the same mismatch view.
  if (emailMismatch) {
    return <EmailMismatchView invitedEmail={invite.tenantEmail} />;
  }

  async function handleConfirm(): Promise<void> {
    if (!acknowledged) {
      setAckError(true);
      return;
    }
    setSubmitError(null);
    try {
      await mutateAsync({ token });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setEmailMismatch(true);
        return;
      }
      setSubmitError("We couldn't accept this invite. Please try again.");
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <div className="space-y-6">
        <header>
          <h2 className="font-heading text-xl text-primary-text">Accept your lease</h2>
          <p className="mt-1 text-sm text-muted-text">
            You&apos;ve been invited by <strong>{invite.landlordFullName}</strong>. Review the terms
            and confirm — we&apos;ll add this lease to your existing account.
          </p>
        </header>

        <LeaseTermsList invite={invite} />

        <label className="flex items-start gap-3 text-sm text-primary-text">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => {
              setAcknowledged(e.target.checked);
              if (e.target.checked) setAckError(false);
            }}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-primary"
            aria-invalid={ackError ? "true" : "false"}
          />
          <span>
            I have reviewed the lease terms above and understand that accepting this invite will bind
            me to these terms once confirmed by the landlord.
          </span>
        </label>
        {ackError && (
          <p className="text-sm text-danger" role="alert">
            You must acknowledge the lease terms to continue
          </p>
        )}

        {submitError && (
          <p className="text-sm text-danger" role="alert">
            {submitError}
          </p>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Accepting…" : "Accept lease"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
