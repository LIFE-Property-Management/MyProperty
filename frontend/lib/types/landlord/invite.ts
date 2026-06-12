import { z } from "zod";

// Invite lifecycle — mirrors the backend InviteStatus enum (serialized as a
// string via the global JsonStringEnumConverter). Revoked = landlord-cancelled,
// distinct from a naturally Expired invite.
export const inviteStatusSchema = z.enum([
  "Pending",
  "Accepted",
  "Rejected",
  "Expired",
  "Revoked",
]);
export type InviteStatus = z.infer<typeof inviteStatusSchema>;

// One row in the landlord invite-management list — mirrors InviteListItemDto
// (JSON camelCase; field order matches the backend record).
export const inviteListItemSchema = z.object({
  id: z.uuid(),
  propertyId: z.uuid(),
  propertyName: z.string(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  status: inviteStatusSchema,
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export type InviteListItem = z.infer<typeof inviteListItemSchema>;

// Standard PagedResult<InviteListItemDto> envelope.
export const invitesResponseSchema = z.object({
  items: z.array(inviteListItemSchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});
export type InvitesResponse = z.infer<typeof invitesResponseSchema>;

// Create-invite form contract — mirrors the backend CreateInviteValidator so the
// client rejects the same inputs the server would. Dates are YYYY-MM-DD strings
// (from <input type="date">); "today" is the UTC date to match the server's
// DateOnly.FromDateTime(DateTime.UtcNow.Date) comparison. Rent is strictly less
// than 1,000,000 (matching the validator's LessThan rule, not its message).
export const createInviteInputSchema = z
  .object({
    propertyId: z.uuid(),
    email: z.email("Enter a valid email address.").max(256),
    firstName: z.string().trim().min(1, "First name is required.").max(100),
    lastName: z.string().trim().min(1, "Last name is required.").max(100),
    proposedStartDate: z.iso.date(),
    proposedEndDate: z.iso.date(),
    proposedMonthlyRent: z
      .number({ error: "Enter the monthly rent." })
      .positive("Monthly rent must be greater than zero.")
      .lt(1_000_000, "Monthly rent must be less than 1,000,000."),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter uppercase ISO code (e.g. EUR)."),
  })
  .refine((v) => v.proposedStartDate >= new Date().toISOString().slice(0, 10), {
    path: ["proposedStartDate"],
    message: "Start date cannot be in the past.",
  })
  .refine((v) => v.proposedEndDate > v.proposedStartDate, {
    path: ["proposedEndDate"],
    message: "End date must be after the start date.",
  });
export type CreateInviteInput = z.infer<typeof createInviteInputSchema>;
