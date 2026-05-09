// Hook-level integration test: stub axios.get/.post and assert that each hook
// routes through the correct endpoint and resolves with the payload.

import { waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import apiClient from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";

import { useLease } from "../useLease";
import { useTenantAccount } from "../useTenantAccount";
import { useCurrentPayment } from "../useCurrentPayment";
import { usePaymentHistory } from "../usePaymentHistory";
import { useSubmitManualRequest } from "../useSubmitManualRequest";
import { useSubmitReceipt } from "../useSubmitReceipt";

// Relative path for jest.mock so hoisting resolves cleanly before `@/*` alias.
jest.mock("../../api/client", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={makeClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
});

describe("useTenantAccount", () => {
  it("GETs /tenant/me and returns the body", async () => {
    mockedGet.mockResolvedValueOnce({ data: { id: "u1" } });
    const { result } = renderHook(() => useTenantAccount(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith(ENDPOINTS.tenantAccount);
    expect(result.current.data).toEqual({ id: "u1" });
  });
});

describe("useLease", () => {
  it("GETs /tenant/lease", async () => {
    mockedGet.mockResolvedValueOnce({ data: { id: "l1" } });
    const { result } = renderHook(() => useLease(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith(ENDPOINTS.lease);
  });
});

describe("useCurrentPayment", () => {
  it("GETs /tenant/payments/current", async () => {
    mockedGet.mockResolvedValueOnce({ data: { id: "p1", status: "Outstanding" } });
    const { result } = renderHook(() => useCurrentPayment(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith(ENDPOINTS.currentPayment);
  });
});

describe("usePaymentHistory", () => {
  it("GETs /tenant/payments/history with page & pageSize as params", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { items: [], totalCount: 0, page: 3, pageSize: 5 },
    });
    const { result } = renderHook(() => usePaymentHistory(3, 5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Accept either params-object (axios) or query-string encoding — both are valid.
    const call = mockedGet.mock.calls[0];
    expect(call[0]).toContain(ENDPOINTS.paymentHistory);
    const either = {
      viaParams: call[1] && (call[1] as { params?: unknown }).params,
      viaQuery: call[0].includes("page=3") && call[0].includes("pageSize=5"),
    };
    expect(either.viaParams || either.viaQuery).toBeTruthy();
  });
});

describe("useSubmitManualRequest", () => {
  it("POSTs JSON to /tenant/payments/manual-request", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useSubmitManualRequest(), { wrapper });
    await result.current.mutateAsync({
      paymentId: "d6e2f9b4-3c7a-4f1e-8a92-1b5c8d4e7f30",
      notes: "paid cash",
    });
    expect(mockedPost).toHaveBeenCalledWith(
        ENDPOINTS.submitManualRequest,
        expect.objectContaining({ notes: "paid cash" }),
    );
  });
});

describe("useSubmitReceipt", () => {
  it("POSTs multipart/form-data to /tenant/payments/receipt", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useSubmitReceipt(), { wrapper });
    const fd = new FormData();
    fd.append("paymentId", "d6e2f9b4-3c7a-4f1e-8a92-1b5c8d4e7f30");
    await result.current.mutateAsync(fd);
    expect(mockedPost).toHaveBeenCalledWith(
        ENDPOINTS.submitReceipt,
        fd,
    );
  });
});
