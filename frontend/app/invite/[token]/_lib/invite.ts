import { z } from "zod";
import { inviteStatusSchema } from "@/lib/types/landlord/invite";

// Mirrors the backend InvitePreviewDto returned by GET /invites/by-token/{token}
// (see PLAN-1-HANDOFF). JSON is camelCase; `status` is a string enum via the
// global JsonStringEnumConverter. Field order matches the backend record.
// Proposed dates are DateOnly (YYYY-MM-DD); expiresAt is an ISO-8601 UTC datetime.
export const invitePreviewSchema = z.object({
  status: inviteStatusSchema,
  propertyName: z.string(),
  propertyAddress: z.string(),
  landlordFullName: z.string(),
  tenantFirstName: z.string(),
  tenantLastName: z.string(),
  tenantEmail: z.email(),
  proposedStartDate: z.iso.date(),
  proposedEndDate: z.iso.date(),
  proposedMonthlyRent: z.number(),
  currency: z.string(),
  expiresAt: z.iso.datetime(),
});

export type InvitePreview = z.infer<typeof invitePreviewSchema>;
