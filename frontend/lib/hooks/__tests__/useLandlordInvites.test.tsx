import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import apiClient from "@/lib/api/client";
import { queryKeys } from "../queryKeys";
import { useLandlordInvites } from "../useLandlordInvites";

jest.mock("@/lib/api/client", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>;
}

const response = {
  items: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      propertyId: "22222222-2222-4222-8222-222222222222",
      propertyName: "Sunset Apt",
      email: "tenant@example.com",
      firstName: "Tess",
      lastName: "Tenant",
      status: "Pending",
      expiresAt: "2030-01-01T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
    },
  ],
  totalCount: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

beforeEach(() => {
  mockedGet.mockReset();
});

describe("useLandlordInvites", () => {
  it("fetches and parses the invite list", async () => {
    mockedGet.mockResolvedValueOnce({ data: response });
    const { result } = renderHook(() => useLandlordInvites(1, 20), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].status).toBe("Pending");
    expect(mockedGet).toHaveBeenCalledWith("/invites", {
      params: { page: 1, pageSize: 20 },
    });
  });

  it("passes the status filter through as a query param", async () => {
    mockedGet.mockResolvedValueOnce({ data: { ...response, items: [], totalCount: 0 } });
    const { result } = renderHook(() => useLandlordInvites(2, 10, "Accepted"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGet).toHaveBeenCalledWith("/invites", {
      params: { page: 2, pageSize: 10, status: "Accepted" },
    });
  });

  it("different (page, pageSize, status) arguments produce different query keys", () => {
    expect(queryKeys.landlord.invites.list(1, 20)).not.toEqual(
      queryKeys.landlord.invites.list(2, 20),
    );
    expect(queryKeys.landlord.invites.list(1, 20)).not.toEqual(
      queryKeys.landlord.invites.list(1, 20, "Pending"),
    );
  });
});
