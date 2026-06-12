import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import apiClient from "@/lib/api/client";
import { queryKeys } from "../queryKeys";
import { useTerminateLease } from "../useTerminateLease";

jest.mock("@/lib/api/client", () => ({
  __esModule: true,
  default: { patch: jest.fn() },
}));

const mockedPatch = apiClient.patch as jest.MockedFunction<typeof apiClient.patch>;

function makeWrapper() {
  const client = makeQueryClient();
  const invalidateSpy = jest.spyOn(client, "invalidateQueries");
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryWrapper";
  return { Wrapper, invalidateSpy };
}

const leaseId = "55555555-5555-5555-5555-555555555555";

beforeEach(() => {
  mockedPatch.mockReset();
});

describe("useTerminateLease", () => {
  it("patches the terminate endpoint for the given lease id", async () => {
    mockedPatch.mockResolvedValueOnce({ data: null });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useTerminateLease(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(leaseId);
    });

    expect(mockedPatch).toHaveBeenCalledWith(`/leases/${leaseId}/terminate`);
  });

  it("invalidates the property, tenant, and dashboard caches on success", async () => {
    mockedPatch.mockResolvedValueOnce({ data: null });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useTerminateLease(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(leaseId);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.property.all() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.tenant.all() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.dashboard() });
  });

  it("does not invalidate caches when the request fails", async () => {
    mockedPatch.mockRejectedValueOnce(new Error("network"));
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useTerminateLease(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(leaseId).catch(() => {});
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
