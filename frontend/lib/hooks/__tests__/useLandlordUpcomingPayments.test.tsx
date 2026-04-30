import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import apiClient from "../../api/client";
import { queryKeys } from "../queryKeys";
import { buildUpcomingPaymentsResponse } from "@/mocks/fixtures";

jest.mock("../../api/client", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

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
});

describe("useLandlordUpcomingPayments", () => {
  it("returns page-1 data with correct totalCount", async () => {
    const fixture = buildUpcomingPaymentsResponse(1, 10);
    mockedGet.mockResolvedValueOnce({ data: fixture });
    const { useLandlordUpcomingPayments } = await import("../useLandlordUpcomingPayments");
    const { result } = renderHook(() => useLandlordUpcomingPayments(1, 10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalCount).toBe(18);
    expect(result.current.data?.items).toHaveLength(10);
  });

  it("different (page, pageSize) arguments produce different query keys", () => {
    expect(queryKeys.landlord.payment.upcoming(1, 10)).not.toEqual(
      queryKeys.landlord.payment.upcoming(2, 10),
    );
  });
});
