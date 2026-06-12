import { z } from "zod";
import {
  inviteListItemSchema,
  invitesResponseSchema,
  type InviteListItem,
  type InviteStatus,
  type InvitesResponse,
} from "@/lib/types/landlord/invite";

const I = (n: string) => `02a00000-0000-7000-8000-0000000000${n}`;
const PR = (n: string) => `02900000-0000-7000-8000-0000000000${n}`;

// A spread of every InviteStatus so dev + tests see each badge and the
// Revoke/Resend actions (which show only for Pending/Expired).
export const invitesFixture: InviteListItem[] = [
  row("01", "01", "Ada", "Lovelace", "Pending", "2026-07-01T09:00:00Z", "2026-06-10T09:00:00Z"),
  row("02", "02", "Alan", "Turing", "Accepted", "2026-06-20T09:00:00Z", "2026-06-09T09:00:00Z"),
  row("03", "03", "Grace", "Hopper", "Pending", "2026-07-03T09:00:00Z", "2026-06-08T09:00:00Z"),
  row("04", "04", "Edsger", "Dijkstra", "Rejected", "2026-06-18T09:00:00Z", "2026-06-07T09:00:00Z"),
  row("05", "05", "Donald", "Knuth", "Expired", "2026-06-05T09:00:00Z", "2026-05-29T09:00:00Z"),
  row("06", "06", "Barbara", "Liskov", "Revoked", "2026-06-22T09:00:00Z", "2026-06-06T09:00:00Z"),
  row("07", "07", "Tim", "Berners-Lee", "Pending", "2026-07-09T09:00:00Z", "2026-06-05T09:00:00Z"),
  row("08", "08", "Margaret", "Hamilton", "Accepted", "2026-06-15T09:00:00Z", "2026-06-04T09:00:00Z"),
  row("09", "09", "Ken", "Thompson", "Expired", "2026-06-02T09:00:00Z", "2026-05-26T09:00:00Z"),
  row("10", "10", "Dennis", "Ritchie", "Pending", "2026-07-12T09:00:00Z", "2026-06-03T09:00:00Z"),
  row("11", "11", "Vint", "Cerf", "Rejected", "2026-06-12T09:00:00Z", "2026-06-02T09:00:00Z"),
  row("12", "12", "Radia", "Perlman", "Revoked", "2026-06-14T09:00:00Z", "2026-06-01T09:00:00Z"),
];

function row(
  n: string,
  pn: string,
  firstName: string,
  lastName: string,
  status: InviteStatus,
  expiresAt: string,
  createdAt: string,
): InviteListItem {
  return {
    id: I(n),
    propertyId: PR(pn),
    propertyName: `Property ${pn}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
    firstName,
    lastName,
    status,
    expiresAt,
    createdAt,
  };
}

z.array(inviteListItemSchema).parse(invitesFixture);

// ── Invite-accept preview (GET /invites/by-token/{token}) ───────────────────
// Mirrors the backend InvitePreviewDto (camelCase; `status` is a string enum).
// The dev/test status is keyed off the token so each branch of the accept flow
// is reachable by URL: a token containing "accepted"/"rejected"/"expired"/
// "revoked" reports that status; anything else is Pending. (A token containing
// "unknown" 404s — see the handler.)
export interface InvitePreviewFixture {
  status: InviteStatus;
  propertyName: string;
  propertyAddress: string;
  landlordFullName: string;
  tenantFirstName: string;
  tenantLastName: string;
  tenantEmail: string;
  proposedStartDate: string;
  proposedEndDate: string;
  proposedMonthlyRent: number;
  currency: string;
  expiresAt: string;
}

const PREVIEW_STATUS_KEYWORDS: ReadonlyArray<[string, InviteStatus]> = [
  ["accepted", "Accepted"],
  ["rejected", "Rejected"],
  ["expired", "Expired"],
  ["revoked", "Revoked"],
];

function statusForToken(token: string): InviteStatus {
  const lower = token.toLowerCase();
  return PREVIEW_STATUS_KEYWORDS.find(([kw]) => lower.includes(kw))?.[1] ?? "Pending";
}

export function buildInvitePreview(token: string): InvitePreviewFixture {
  return {
    status: statusForToken(token),
    propertyName: "Maple Court",
    propertyAddress: "123 Main St, Prishtina",
    landlordFullName: "Ada Landlord",
    tenantFirstName: "Jane",
    tenantLastName: "Doe",
    tenantEmail: "tenant@example.com",
    proposedStartDate: "2026-07-01",
    proposedEndDate: "2027-06-30",
    proposedMonthlyRent: 450,
    currency: "EUR",
    expiresAt: "2026-07-08T09:00:00Z",
  };
}

export function buildLandlordInvitesResponse(
  page: number,
  pageSize: number,
  status?: InviteStatus,
): InvitesResponse {
  const filtered = status
    ? invitesFixture.filter((i) => i.status === status)
    : invitesFixture;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  const totalCount = filtered.length;
  return invitesResponseSchema.parse({
    items,
    totalCount,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  });
}
