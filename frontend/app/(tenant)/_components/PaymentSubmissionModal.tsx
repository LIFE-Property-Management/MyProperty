// Store-driven modal shell — reads activeModal/activePaymentId from Zustand instead of
// accepting props. This decouples the trigger (PaymentSection buttons) from the modal,
// letting any future component open payment modals via the store's openModal action.
// If the user closes the modal mid-submission, the mutation continues in the background;
// useSubmitReceipt/useSubmitManualRequest still invalidate queries on success.
'use client';

import { Modal } from '@/components/ui/Modal';
import { ReceiptUploadForm } from './ReceiptUploadForm';
import { ManualRequestForm } from './ManualRequestForm';
import useTenantStore from '@/lib/store/useTenantStore';

export function PaymentSubmissionModal() {
    const activeModal = useTenantStore((s) => s.activeModal);
    const activePaymentId = useTenantStore((s) => s.activePaymentId);
    const closeModal = useTenantStore((s) => s.closeModal);

    const isOpen = activeModal !== null;

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
