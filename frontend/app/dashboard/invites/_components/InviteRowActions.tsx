"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useRevokeInvite } from "@/lib/hooks/useRevokeInvite";
import { useResendInvite } from "@/lib/hooks/useResendInvite";
import type { InviteListItem } from "@/lib/types/landlord/invite";

// Per-row actions on the invite-management table. Only Pending and Expired
// invites can be revoked or resent (the backend rejects the rest with 409), so
// for any other status this renders nothing. Each action confirms in a Modal.
export default function InviteRowActions({ invite }: { invite: InviteListItem }) {
  const [confirm, setConfirm] = useState<null | "revoke" | "resend">(null);
  const revoke = useRevokeInvite();
  const resend = useResendInvite();

  const actionable = invite.status === "Pending" || invite.status === "Expired";
  if (!actionable) return null;

  const who = `${invite.firstName} ${invite.lastName}`;

  function close() {
    setConfirm(null);
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="secondary" size="sm" onClick={() => setConfirm("resend")}>
        Resend
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setConfirm("revoke")}>
        Revoke
      </Button>

      <Modal
        isOpen={confirm === "resend"}
        onClose={close}
        title="Resend invitation?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={resend.isPending}
              onClick={() => resend.mutate(invite.id, { onSuccess: close })}
            >
              Resend invitation
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-text">
          A fresh invitation email will be sent to {invite.email}. The previous link
          stops working and the expiry resets.
        </p>
        {resend.isError && (
          <p className="mt-2 text-sm text-danger" role="alert">
            Could not resend the invitation. Please try again.
          </p>
        )}
      </Modal>

      <Modal
        isOpen={confirm === "revoke"}
        onClose={close}
        title="Revoke invitation?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={close}>
              Keep invitation
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={revoke.isPending}
              onClick={() => revoke.mutate(invite.id, { onSuccess: close })}
            >
              Yes, revoke
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-text">
          This cancels {who}’s invitation — the emailed link stops working. You can
          invite them again afterwards.
        </p>
        {revoke.isError && (
          <p className="mt-2 text-sm text-danger" role="alert">
            Could not revoke the invitation. Please try again.
          </p>
        )}
      </Modal>
    </div>
  );
}
