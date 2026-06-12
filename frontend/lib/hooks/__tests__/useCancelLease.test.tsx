import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import apiClient from "@/lib/api/client";
import { queryKeys } from "../queryKeys";
import { useCancelLease } from "../useCancelLease";

jest.mock("@/lib/api/client", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

function makeWrapper() {
  const client = makeQueryClient();
  const invalidateSpy = jest.spyOn(client, "invalidateQueries");
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryWrapper";
  return { Wrapper, invalidateSpy };
}

beforeEach(() => {
  mockedPost.mockReset();
});

describe("useCancelLease", () => {
  it("posts to the cancel endpoint with no body", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCancelLease(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockedPost).toHaveBeenCalledWith("/tenant/lease/cancel");
  });

  it("invalidates the tenant lease and /me caches on success", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCancelLease(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.tenant.lease() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["me"] });
  });

  it("does not invalidate caches when the request fails", async () => {
    mockedPost.mockRejectedValueOnce(new Error("network"));
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCancelLease(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
