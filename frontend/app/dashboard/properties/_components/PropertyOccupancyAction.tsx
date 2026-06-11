"use client";

import { useState } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";
import { useRevokeInvite } from "@/lib/hooks/useRevokeInvite";
import { useTerminateLease } from "@/lib/hooks/useTerminateLease";

export interface PropertyOccupancyActionProps {
  propertyId: string;
  hasActiveLease: boolean;
  hasPendingInvite: boolean;
  // The Active lease's id (when leased) — required to terminate. On the detail
  // page, derive it from the tenant row whose leaseStatus is "Active".
  activeLeaseId: string | null;
  // The pending invite's id (when an invite is pending) — required to revoke.
  // Falls back to a link to the invites page if absent.
  pendingInviteId?: string | null;
  size?: "sm" | "md";
}

const ADD_LEASE_BASE =
  "inline-flex items-center rounded-md bg-primary text-white font-medium " +
  "hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-primary transition-colors duration-150";

// Three-state property action (D7): Leased → "Cancel lease"; else Invite
// pending → "Invitation pending" + "Cancel invitation"; else Vacant → "Add
// lease" (creates an invite, D8). Precedence is active lease → pending → vacant.
export default function PropertyOccupancyAction({
  propertyId,
  hasActiveLease,
  hasPendingInvite,
  activeLeaseId,
  pendingInviteId,
  size = "md",
}: PropertyOccupancyActionProps) {
  const [confirm, setConfirm] = useState<null | "lease" | "invite">(null);
  const terminate = useTerminateLease();
  const revoke = useRevokeInvite();

  const btnSize = size === "sm" ? "sm" : "md";
  const addLeaseSizing = size === "sm" ? "h-8 px-3 text-sm gap-1.5" : "h-10 px-4 text-sm gap-2";

  function closeConfirm() {
    setConfirm(null);
  }

  if (hasActiveLease) {
    return (
      <>
        <Button
          variant="secondary"
          size={btnSize}
          onClick={() => setConfirm("lease")}
          disabled={!activeLeaseId}
        >
          Cancel lease
        </Button>
        <Modal
          isOpen={confirm === "lease"}
          onClose={closeConfirm}
          title="Cancel lease?"
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={closeConfirm}>
                Keep lease
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={terminate.isPending}
                onClick={() =>
                  activeLeaseId &&
                  terminate.mutate(activeLeaseId, { onSuccess: closeConfirm })
                }
              >
                Yes, cancel lease
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-text">
            This ends the active lease and frees the property. This can’t be undone.
          </p>
          {terminate.isError && (
            <p className="mt-2 text-sm text-danger" role="alert">
              Could not cancel the lease. Please try again.
            </p>
          )}
        </Modal>
      </>
    );
  }

  if (hasPendingInvite) {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="info">Invitation pending</Badge>
        {pendingInviteId ? (
          <>
            <Button variant="secondary" size={btnSize} onClick={() => setConfirm("invite")}>
              Cancel invitation
            </Button>
            <Modal
              isOpen={confirm === "invite"}
              onClose={closeConfirm}
              title="Cancel invitation?"
              size="sm"
              footer={
                <>
                  <Button variant="secondary" size="sm" onClick={closeConfirm}>
                    Keep invitation
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={revoke.isPending}
                    onClick={() => revoke.mutate(pendingInviteId, { onSuccess: closeConfirm })}
                  >
                    Yes, cancel invitation
                  </Button>
                </>
              }
            >
              <p className="text-sm text-muted-text">
                This revokes the pending invitation — the emailed link stops working.
                You can invite the tenant again afterwards.
              </p>
              {revoke.isError && (
                <p className="mt-2 text-sm text-danger" role="alert">
                  Could not cancel the invitation. Please try again.
                </p>
              )}
            </Modal>
          </>
        ) : (
          <Link
            href="/dashboard/invites"
            className="text-sm text-primary font-medium hover:underline focus-visible:underline focus-visible:outline-none"
          >
            Manage
          </Link>
        )}
      </div>
    );
  }

  return (
    <Link
      href={`/dashboard/invites/new?propertyId=${encodeURIComponent(propertyId)}`}
      onClick={() => capture(ANALYTICS_EVENTS.tenantInviteStarted, { propertyId })}
      className={`${ADD_LEASE_BASE} ${addLeaseSizing}`}
    >
      Add lease
    </Link>
  );
}
