// MyProperty — Tenant Portal — Shared enums used across multiple schemas
import { z } from "zod"

// Each enum exports two things:
// 1. The schema (e.g. paymentStatusSchema) — used by Zod to validate API responses at runtime
// 2. The type (e.g. PaymentStatus) — used by TypeScript for compile-time type checking
// z.infer<> extracts the TS type from the schema automatically so they never go out of sync

export const paymentStatusSchema = z.enum(["Outstanding", "Pending", "Confirmed", "Rejected"])
export type PaymentStatus = z.infer<typeof paymentStatusSchema>

// ReceiptUpload = digital payment (tenant uploads a receipt file)
// ManualRequest = cash payment (tenant describes the payment in text)
export const paymentMethodSchema = z.enum(["ReceiptUpload", "ManualRequest"])
export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const leaseStatusSchema = z.enum(["Active", "Expired", "Terminated"])
export type LeaseStatus = z.infer<typeof leaseStatusSchema>


// ReadOnly = post-lease accounts — tenant had an active lease but it ended.
// These accounts are never deleted, just downgraded to read-only. See portals.md.
export const tenantAccountStatusSchema = z.enum(["Active", "ReadOnly"])
export type TenantAccountStatus = z.infer<typeof tenantAccountStatusSchema>
