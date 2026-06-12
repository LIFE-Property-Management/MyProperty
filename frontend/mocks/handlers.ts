import { http, HttpResponse, delay } from "msw";

const keycloakLogoutUrl = `${process.env.NEXT_PUBLIC_KEYCLOAK_URL}/realms/${process.env.NEXT_PUBLIC_KEYCLOAK_REALM}/protocol/openid-connect/logout`;
import type { Payment } from "@/lib/types";
import type { InviteStatus } from "@/lib/types/landlord/invite";
import {
    leaseFixture,
    currentPaymentFixture,
    buildPaymentHistoryResponse,
    landlordDashboardFixture,
    stakeholderDashboardFixture,
    buildUpcomingPaymentsResponse,
    buildPropertiesResponse,
    buildPropertyDetail,
    buildLandlordInvitesResponse,
    buildInvitePreview,
    buildTenantsResponse,
    tenantDetailFixtures,
} from "./fixtures";

// In-memory "current payment" state — lets the dashboard show the post-submit
// Pending state after a mutation, then a refetch of GET /current. The state
// resets on page reload since the worker is per-page.
let currentPaymentState: Payment = currentPaymentFixture;

function parsePositiveInt(value: string | null, fallback: number): number {
    if (value === null) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const handlers = [
    http.post(keycloakLogoutUrl, () => {
        return new HttpResponse(null, { status: 204 });
    }),

    // GET /me → MeDto. We mock the slice useMe consumes (accountStatus); the
    // real response also carries id/email/roles etc. There is no /tenant/me
    // route — identity stays on /me (the lease read moved to /tenant/lease).
    http.get("/me", async () => {
        await delay(300);
        return HttpResponse.json({ accountStatus: "Active" });
    }),

    http.get("/tenant/lease", async () => {
        await delay(300);
        return HttpResponse.json(leaseFixture);
    }),

    // Tenant self-service cancel. No body; 204. Mirrors POST /tenant/lease/cancel.
    http.post("/tenant/lease/cancel", async () => {
        await delay(300);
        return new HttpResponse(null, { status: 204 });
    }),

    http.get("/tenant/payments/current", async () => {
        await delay(300);
        return HttpResponse.json(currentPaymentState);
    }),

    http.get("/tenant/payments/history", async ({ request }) => {
        await delay(300);
        const url = new URL(request.url);
        const page = parsePositiveInt(url.searchParams.get("page"), 1);
        const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 10);
        return HttpResponse.json(buildPaymentHistoryResponse(page, pageSize));
    }),

    http.post("/tenant/payments/receipt", async ({ request }) => {
        await delay(500);
        await request.formData();
        currentPaymentState = {
            ...currentPaymentState,
            status: "Pending",
            method: "ReceiptUpload",
            submittedAt: new Date().toISOString(),
        };
        return HttpResponse.json(currentPaymentState);
    }),

    http.get("/landlord/dashboard", async () => {
        await delay(300);
        return HttpResponse.json(landlordDashboardFixture);
    }),

    http.get("/admin/dashboard", async () => {
        await delay(300);
        return HttpResponse.json(stakeholderDashboardFixture);
    }),

    http.get("/landlord/tenants", async ({ request }) => {
        await delay(300);
        const url = new URL(request.url);
        const page = parsePositiveInt(url.searchParams.get("page"), 1);
        const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 10);
        return HttpResponse.json(buildTenantsResponse(page, pageSize));
    }),

    http.get("/landlord/tenants/:id", async ({ params }) => {
        await delay(300);
        const detail = tenantDetailFixtures[params.id as string];
        if (!detail) return new HttpResponse(null, { status: 404 });
        return HttpResponse.json(detail);
    }),

    http.get("/properties", async ({ request }) => {
        await delay(300);
        const url = new URL(request.url);
        const page = parsePositiveInt(url.searchParams.get("page"), 1);
        const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 10);
        return HttpResponse.json(buildPropertiesResponse(page, pageSize));
    }),

    http.get("/properties/:id", async ({ params }) => {
        await delay(300);
        const detail = buildPropertyDetail(params.id as string);
        if (!detail) return new HttpResponse(null, { status: 404 });
        return HttpResponse.json(detail);
    }),

    // ── Landlord invites (Plan 4) ─────────────────────────────────────────────
    // Mutations return contract-shaped responses but do not mutate fixture state
    // (the list is rebuilt fresh per GET) — mirrors the payment-confirm handler.
    // The hooks invalidate + refetch, so the dev UI stays coherent on the GET.
    http.get("/invites", async ({ request }) => {
        await delay(300);
        const url = new URL(request.url);
        const page = parsePositiveInt(url.searchParams.get("page"), 1);
        const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 10);
        const status = url.searchParams.get("status") as InviteStatus | null;
        return HttpResponse.json(
            buildLandlordInvitesResponse(page, pageSize, status ?? undefined),
        );
    }),

    http.post("/invites", async ({ request }) => {
        await delay(400);
        await request.json();
        return HttpResponse.json({
            inviteId: "02a00000-0000-7000-8000-0000000000ff",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
    }),

    http.post("/invites/:id/revoke", async () => {
        await delay(300);
        return new HttpResponse(null, { status: 204 });
    }),

    http.post("/invites/:id/resend", async ({ params }) => {
        await delay(300);
        return HttpResponse.json({
            inviteId: params.id as string,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
    }),

    http.patch("/leases/:id/terminate", async () => {
        await delay(300);
        return new HttpResponse(null, { status: 204 });
    }),

    // ── Invite-accept flow (Plan 5) ───────────────────────────────────────────
    // Anonymous preview. Returns 200 with the real status for any resolved
    // invite; 404 only for an unknown token. Token keywords drive the dev/test
    // status (see buildInvitePreview): "...-accepted/-rejected/-expired/-revoked",
    // "...-unknown" → 404. "...-existing" (accept) → 409, "...-mismatch" (claim)
    // → 403, so every branch of the wizard is reachable by URL.
    http.get("/invites/by-token/:token", async ({ params }) => {
        await delay(300);
        const token = params.token as string;
        if (token.toLowerCase().includes("unknown")) {
            return HttpResponse.json({ detail: "Invite not found." }, { status: 404 });
        }
        return HttpResponse.json(buildInvitePreview(token));
    }),

    http.post("/invites/:token/accept", async ({ request, params }) => {
        await delay(400);
        await request.json();
        const token = (params.token as string).toLowerCase();
        if (token.includes("existing")) {
            return HttpResponse.json(
                { detail: "An account for tenant@example.com already exists. Please log in instead." },
                { status: 409 },
            );
        }
        return HttpResponse.json({
            inviteId: "02a00000-0000-7000-8000-0000000000aa",
            leaseId: "02b00000-0000-7000-8000-0000000000aa",
        });
    }),

    http.post("/invites/:token/claim", async ({ params }) => {
        await delay(400);
        const token = (params.token as string).toLowerCase();
        if (token.includes("mismatch")) {
            return HttpResponse.json(
                { detail: "This invite was sent to a different email address." },
                { status: 403 },
            );
        }
        return HttpResponse.json({
            inviteId: "02a00000-0000-7000-8000-0000000000bb",
            leaseId: "02b00000-0000-7000-8000-0000000000bb",
        });
    }),

    http.get("/landlord/payments/upcoming", async ({ request }) => {
        await delay(300);
        const url = new URL(request.url);
        const page = parsePositiveInt(url.searchParams.get("page"), 1);
        const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 10);
        return HttpResponse.json(buildUpcomingPaymentsResponse(page, pageSize));
    }),

    http.post("/tenant/payments/manual-request", async ({ request }) => {
        await delay(500);
        await request.json();
        currentPaymentState = {
            ...currentPaymentState,
            status: "Pending",
            method: "ManualRequest",
            submittedAt: new Date().toISOString(),
        };
        return HttpResponse.json(currentPaymentState);
    }),

    // Landlord confirms a Pending payment (Pending → Confirmed). Mirrors the
    // real PaymentConfirmedDto { paymentId, confirmedAt }. The upcoming-payments
    // list is rebuilt fresh per request, so there's no landlord-side state to
    // mutate here. The hooks ignore the body and refetch via cache invalidation,
    // so the shape is for contract fidelity only.
    http.post("/payments/:id/confirm", async ({ params }) => {
        await delay(400);
        return HttpResponse.json({
            paymentId: params.id as string,
            confirmedAt: new Date().toISOString(),
        });
    }),

    // Landlord rejects a Pending payment with a required reason
    // (Pending → Rejected). Mirrors the real PaymentRejectedDto
    // { paymentId, rejectedAt } — the reason is consumed server-side and not
    // echoed back, so the mock ignores the request body.
    http.post("/payments/:id/reject", async ({ params }) => {
        await delay(400);
        return HttpResponse.json({
            paymentId: params.id as string,
            rejectedAt: new Date().toISOString(),
        });
    }),
];
