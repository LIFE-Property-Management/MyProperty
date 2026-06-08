// Store-driven modal shell — reads activeModal/activePaymentId from Zustand instead of
// accepting props. This decouples the trigger (PaymentSection buttons) from the modal,
// letting any future component open payment modals via the store's openModal action.
// If the user closes the modal mid-submission, the mutation continues in the background;
// useSubmitReceipt/useSubmitManualRequest still invalidate queries on success.
'use client';

import { useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ReceiptUploadForm } from './ReceiptUploadForm';
import { ManualRequestForm } from './ManualRequestForm';
import useTenantStore from '@/lib/store/useTenantStore';
import { ANALYTICS_EVENTS, capture } from '@/lib/analytics';

export function PaymentSubmissionModal() {
  const activeModal = useTenantStore((s) => s.activeModal);
  const activePaymentId = useTenantStore((s) => s.activePaymentId);
  const closeModal = useTenantStore((s) => s.closeModal);

  const isOpen = activeModal !== null;

  // Payment-collection funnel — submission started (modal opened). `activeModal`
  // doubles as the chosen method (receiptUpload | manualRequest).
  useEffect(() => {
    if (activeModal !== null) {
      capture(ANALYTICS_EVENTS.paymentSubmissionStarted, { method: activeModal });
    }
  }, [activeModal]);

  // Store contract: openModal sets both fields atomically, but TS needs the null guard.
  if (!isOpen || !activePaymentId) return null;

  const title =
      activeModal === 'receiptUpload' ? 'Upload Receipt' : 'Request Manual Confirmation';

  return (
      <Modal
          isOpen={isOpen}
          onClose={closeModal}
          title={title}
          size="md"
          dismissOnBackdrop
          dismissOnEsc
          showCloseButton
      >
        {activeModal === 'receiptUpload' ? (
            <ReceiptUploadForm paymentId={activePaymentId} onSuccess={closeModal} />
        ) : (
            <ManualRequestForm paymentId={activePaymentId} onSuccess={closeModal} />
        )}
      </Modal>
  );
}
