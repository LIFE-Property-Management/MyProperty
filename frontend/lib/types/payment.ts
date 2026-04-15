// MyProperty — Tenant Portal — Payment schemas
import { z } from "zod"
import { paymentStatusSchema, paymentMethodSchema } from "./enums"

// Read model — represents a payment record as returned by the API.
// Nullable fields map to the 4 payment states:
// Outstanding → method/submittedAt/confirmedAt/rejectedAt are all null (nothing submitted yet)
// Pending     → method + submittedAt are set
// Confirmed   → confirmedAt is set
// Rejected    → rejectedAt + rejectionReason are set
export const paymentSchema = z.object({
  id: z.string().uuid(),
  leaseId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3), // ISO 4217 e.g. "EUR"
  dueDate: z.string().date(), // YYYY-MM-DD
  status: paymentStatusSchema,
  method: paymentMethodSchema.nullable(), // null when Outstanding
  submittedAt: z.string().datetime().nullable(),
  confirmedAt: z.string().datetime().nullable(),
  rejectedAt: z.string().datetime().nullable(),
  rejectionReason: z.string().nullable(),
  receiptFileName: z.string().nullable(),  // null unless ReceiptUpload
  receiptFileUrl: z.string().url().nullable(), // null unless ReceiptUpload
  notes: z.string().nullable(),
})

export type Payment = z.infer<typeof paymentSchema>

// Form schema for digital payment submission (tenant uploads a receipt file).
// Client-side only — z.instanceof(File) works in the browser, not on the server.
// Two .refine() calls add custom validation on top of the base type check.
export const receiptUploadFormSchema = z.object({
  paymentId: z.string().uuid(),
  receipt: z
    .instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, { message: "File must be 5MB or less" })
    .refine((file) => ["image/jpeg", "image/png", "application/pdf"].includes(file.type), {
      message: "File must be JPEG, PNG, or PDF",
    }),
  notes: z.string().max(500).optional(),
})

export type ReceiptUploadFormValues = z.infer<typeof receiptUploadFormSchema>

// Form schema for cash payment submission (no file — tenant describes the payment).
// notes is required here (unlike receipt upload) — tenant must explain the cash payment.
export const manualRequestFormSchema = z.object({
  paymentId: z.string().uuid(),
  notes: z.string().min(1, { message: "Please describe the cash payment" }).max(500),
})

export type ManualRequestFormValues = z.infer<typeof manualRequestFormSchema>

// Slimmed down read model for the payment history table.
// Separate from paymentSchema — history table doesn't need receipt URLs or rejection details.
export const paymentHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  dueDate: z.string().date(),
  status: paymentStatusSchema,
  method: paymentMethodSchema.nullable(),
  submittedAt: z.string().datetime().nullable(),
  confirmedAt: z.string().datetime().nullable(),
})

export type PaymentHistoryEntry = z.infer<typeof paymentHistoryEntrySchema>


// Wraps the paginated payment history API response.
// page is positive() because history is 1-indexed (no page 0).
// totalCount is nonnegative() because 0 results is valid.
export const paymentHistoryResponseSchema = z.object({
  items: z.array(paymentHistoryEntrySchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
})

export type PaymentHistoryResponse = z.infer<typeof paymentHistoryResponseSchema>
