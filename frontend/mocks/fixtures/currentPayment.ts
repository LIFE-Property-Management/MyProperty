import type { Payment } from "@/lib/types";
import { leaseFixture } from "./lease";

export const currentPaymentFixture: Payment = {
  id: "d6e2f9b4-3c7a-4f1e-8a92-1b5c8d4e7f30",
  leaseId: leaseFixture.id,
  amount: leaseFixture.monthlyRent,
  currency: leaseFixture.currency,
  dueDate: "2026-04-30",
  status: "Outstanding",
  method: null,
  submittedAt: null,
  confirmedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  receiptFileName: null,
  receiptFileUrl: null,
  notes: null,
};
