import { http, HttpResponse, delay } from "msw";

const keycloakLogoutUrl = `${process.env.NEXT_PUBLIC_KEYCLOAK_URL}/realms/${process.env.NEXT_PUBLIC_KEYCLOAK_REALM}/protocol/openid-connect/logout`;
import type { Payment } from "@/lib/types";
import {
  tenantAccountFixture,
  leaseFixture,
  currentPaymentFixture,
  buildPaymentHistoryResponse,
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
];
