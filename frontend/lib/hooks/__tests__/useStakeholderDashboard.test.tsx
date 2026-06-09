import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AxiosError } from "axios";
import apiClient from "../../api/client";
import { queryKeys } from "../queryKeys";
import { stakeholderDashboardFixture } from "@/mocks/fixtures";

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

describe("useStakeholderDashboard", () => {
  it("returns stakeholderDashboardFixture data on successful fetch", async () => {
    mockedGet.mockResolvedValueOnce({ data: stakeholderDashboardFixture });
    const { useStakeholderDashboard } = await import("../useStakeholderDashboard");
    const { result } = renderHook(() => useStakeholderDashboard(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stakeholderDashboardFixture);
  });

  it("falls back to an empty dashboard on a 404", async () => {
    const notFound = new AxiosError("Not found");
    notFound.response = { status: 404 } as AxiosError["response"];
    mockedGet.mockRejectedValueOnce(notFound);
    const { useStakeholderDashboard } = await import("../useStakeholderDashboard");
    const { result } = renderHook(() => useStakeholderDashboard(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.growth.totalUsers).toBe(0);
    expect(result.current.data?.financial.byCurrency).toEqual([]);
  });

  it("isError is true when apiClient.get rejects with a non-404", async () => {
    mockedGet.mockRejectedValueOnce(new Error("Network error"));
    const { useStakeholderDashboard } = await import("../useStakeholderDashboard");
    const { result } = renderHook(() => useStakeholderDashboard(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("uses the correct query key", () => {
    expect(queryKeys.admin.dashboard()).toEqual(["admin", "dashboard"]);
  });
});
