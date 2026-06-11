import { http, HttpResponse, delay } from "msw";

const keycloakLogoutUrl = `${process.env.NEXT_PUBLIC_KEYCLOAK_URL}/realms/${process.env.NEXT_PUBLIC_KEYCLOAK_REALM}/protocol/openid-connect/logout`;
import type { Payment } from "@/lib/types";
import {
    tenantAccountFixture,
    leaseFixture,
    currentPaymentFixture,
    buildPaymentHistoryResponse,
    landlordDashboardFixture,
    stakeholderDashboardFixture,
    buildUpcomingPaymentsResponse,
    buildPropertiesResponse,
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

    http.get("/me", async () => {
        await delay(300);
        return HttpResponse.json({ tenantAccountStatus: "Active" });
    }),

    http.get("/tenant/me", async () => {
        await delay(300);
        return HttpResponse.json(tenantAccountFixture);
    }),

    http.get("/tenant/lease", async () => {
        await delay(300);
        return HttpResponse.json(leaseFixture);
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
