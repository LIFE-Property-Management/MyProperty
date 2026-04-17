import { http, HttpResponse, delay } from "msw";
import type { Payment } from "@/lib/types";
import {
  tenantAccountFixture,
  leaseFixture,
  currentPaymentFixture,
  buildPaymentHistoryResponse,
} from "./fixtures";

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const handlers = [
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
    return HttpResponse.json(currentPaymentFixture);
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
    const submitted: Payment = {
      ...currentPaymentFixture,
      status: "Pending",
      method: "ReceiptUpload",
      submittedAt: new Date().toISOString(),
    };
    return HttpResponse.json(submitted);
  }),

  http.post("/tenant/payments/manual-request", async ({ request }) => {
    await delay(500);
    await request.json();
    const submitted: Payment = {
      ...currentPaymentFixture,
      status: "Pending",
      method: "ManualRequest",
      submittedAt: new Date().toISOString(),
    };
    return HttpResponse.json(submitted);
  }),
];
