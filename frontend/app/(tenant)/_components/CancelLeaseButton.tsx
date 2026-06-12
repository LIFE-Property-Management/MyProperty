"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useCancelLease } from "@/lib/hooks";
import type { LeaseStatus } from "@/lib/types";

export interface CancelLeaseButtonProps {
  // The current lease status. The action is only offered for an Active lease
  // (D2) — an Expired/Terminated lease has nothing to cancel.
  status: LeaseStatus;
}

// Tenant self-service "Cancel lease" (D2): immediate termination via
// POST /tenant/lease/cancel; the backend emails the landlord. Confirm modal
// mirrors the landlord PropertyOccupancyAction "Cancel lease" flow. Renders
// nothing unless the lease is Active.
export function CancelLeaseButton({ status }: CancelLeaseButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const cancel = useCancelLease();

  if (status !== "Active") return null;

  function close() {
    setIsConfirmOpen(false);
  }

  return (
    <div className="mt-6 flex justify-end border-t border-border pt-4">
      <Button variant="danger" size="sm" onClick={() => setIsConfirmOpen(true)}>
        Cancel lease
      </Button>
      <Modal
        isOpen={isConfirmOpen}
        onClose={close}
        title="Cancel your lease?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={close}>
              Keep lease
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={cancel.isPending}
              onClick={() => cancel.mutate(undefined, { onSuccess: close })}
            >
              Yes, cancel lease
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-text">
          This ends your tenancy immediately and notifies your landlord. This
          can’t be undone.
        </p>
        {cancel.isError && (
          <p className="mt-2 text-sm text-danger" role="alert">
            Could not cancel your lease. Please try again.
          </p>
        )}
      </Modal>
    </div>
  );
}
