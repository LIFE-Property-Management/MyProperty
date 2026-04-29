import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import apiClient from "../../api/client";
import { queryKeys } from "../queryKeys";
import { landlordDashboardFixture } from "@/mocks/fixtures";

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

describe("useLandlordDashboard", () => {
  it("returns landlordDashboardFixture data on successful fetch", async () => {
    mockedGet.mockResolvedValueOnce({ data: landlordDashboardFixture });
    const { useLandlordDashboard } = await import("../useLandlordDashboard");
    const { result } = renderHook(() => useLandlordDashboard(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(landlordDashboardFixture);
  });

  it("isLoading is true before resolution", async () => {
    let resolve!: (v: unknown) => void;
    mockedGet.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const { useLandlordDashboard } = await import("../useLandlordDashboard");
    const { result } = renderHook(() => useLandlordDashboard(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    resolve({ data: landlordDashboardFixture });
  });

  it("isError is true when apiClient.get rejects", async () => {
    mockedGet.mockRejectedValueOnce(new Error("Network error"));
    const { useLandlordDashboard } = await import("../useLandlordDashboard");
    const { result } = renderHook(() => useLandlordDashboard(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("uses the correct query key", () => {
    expect(queryKeys.landlord.dashboard()).toEqual(["landlord", "dashboard"]);
  });
});
