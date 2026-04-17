import type { PaymentHistoryEntry, PaymentHistoryResponse } from "@/lib/types";

const entries: PaymentHistoryEntry[] = [
  {
    id: "f1a8c4d2-9b3e-4f76-a521-7c8d9e0f1234",
    amount: 350,
    currency: "EUR",
    dueDate: "2026-03-31",
    status: "Pending",
    method: "ReceiptUpload",
    submittedAt: "2026-04-02T10:15:00Z",
    confirmedAt: null,
  },
  {
    id: "e2b9d5c3-1c4f-5a87-b632-8d9e0f1a2345",
    amount: 350,
    currency: "EUR",
    dueDate: "2026-02-28",
    status: "Confirmed",
    method: "ReceiptUpload",
    submittedAt: "2026-02-26T14:30:00Z",
    confirmedAt: "2026-02-27T09:12:00Z",
  },
  {
    id: "d3c0e6b4-2d5a-6b98-c743-9e0f1a2b3456",
    amount: 350,
    currency: "EUR",
    dueDate: "2026-01-31",
    status: "Confirmed",
    method: "ReceiptUpload",
    submittedAt: "2026-01-29T11:05:00Z",
    confirmedAt: "2026-01-30T08:40:00Z",
  },
  {
    id: "c4d1f7a5-3e6b-7c09-d854-0f1a2b3c4567",
    amount: 350,
    currency: "EUR",
    dueDate: "2025-12-31",
    status: "Confirmed",
    method: "ManualRequest",
    submittedAt: "2025-12-30T16:22:00Z",
    confirmedAt: "2026-01-02T10:00:00Z",
  },
  {
    id: "b5e2a8b6-4f7c-8d10-e965-1a2b3c4d5678",
    amount: 350,
    currency: "EUR",
    dueDate: "2025-11-30",
    status: "Confirmed",
    method: "ReceiptUpload",
    submittedAt: "2025-11-28T13:45:00Z",
    confirmedAt: "2025-11-29T09:30:00Z",
  },
  {
    id: "a6f3b9c7-5a8d-9e21-fa76-2b3c4d5e6789",
    amount: 350,
    currency: "EUR",
    dueDate: "2025-10-31",
    status: "Rejected",
    method: "ReceiptUpload",
    submittedAt: "2025-10-30T15:10:00Z",
    confirmedAt: null,
  },
  {
    id: "97a4c0d8-6b9e-0f32-0b87-3c4d5e6f7890",
    amount: 350,
    currency: "EUR",
    dueDate: "2025-09-30",
    status: "Confirmed",
    method: "ReceiptUpload",
    submittedAt: "2025-09-28T12:18:00Z",
    confirmedAt: "2025-09-29T10:05:00Z",
  },
  {
    id: "88b5d1e9-7c0f-1a43-1c98-4d5e6f7a8901",
    amount: 350,
    currency: "EUR",
    dueDate: "2025-08-31",
    status: "Confirmed",
    method: "ReceiptUpload",
    submittedAt: "2025-08-29T11:33:00Z",
    confirmedAt: "2025-08-30T09:21:00Z",
  },
  {
    id: "79c6e2f0-8d1a-2b54-2da9-5e6f7a8b9012",
    amount: 350,
    currency: "EUR",
    dueDate: "2025-07-31",
    status: "Confirmed",
    method: "ReceiptUpload",
    submittedAt: "2025-07-30T10:42:00Z",
    confirmedAt: "2025-07-31T08:55:00Z",
  },
  {
    id: "6ad7f3a1-9e2b-3c65-3eba-6f7a8b9c0123",
    amount: 350,
    currency: "EUR",
    dueDate: "2025-06-30",
    status: "Confirmed",
    method: "ReceiptUpload",
    submittedAt: "2025-06-29T14:08:00Z",
    confirmedAt: "2025-06-30T11:14:00Z",
  },
  {
    id: "5be8a4b2-0f3c-4d76-4fcb-7a8b9c0d1234",
    amount: 350,
    currency: "EUR",
    dueDate: "2025-05-31",
    status: "Confirmed",
    method: "ReceiptUpload",
    submittedAt: "2025-05-30T09:55:00Z",
    confirmedAt: "2025-05-31T10:20:00Z",
  },
];

export const paymentHistoryAll: PaymentHistoryEntry[] = entries;

export function buildPaymentHistoryResponse(
  page: number,
  pageSize: number
): PaymentHistoryResponse {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: entries.slice(start, end),
    totalCount: entries.length,
    page,
    pageSize,
  };
}
