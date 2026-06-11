import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import apiClient from "@/lib/api/client";
import { queryKeys } from "../queryKeys";
import { useConfirmPayment } from "../useConfirmPayment";

// Tests the hook's own logic — the confirm POST and the cache invalidation it
// triggers on success. apiClient is mocked so nothing real is hit. Mirrors the
// renderHook pattern in lib/hooks/auth/__tests__/useSignupMutation.test.tsx.
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

const paymentId = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  mockedPost.mockReset();
});

describe("useConfirmPayment", () => {
  it("posts to the confirm endpoint for the given payment id", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useConfirmPayment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(paymentId);
    });

    expect(mockedPost).toHaveBeenCalledWith(`/payments/${paymentId}/confirm`);
  });

  it("invalidates the payment, dashboard, and tenant caches on success", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useConfirmPayment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(paymentId);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.payment.all() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.dashboard() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.tenant.all() });
  });

  it("does not invalidate caches when the request fails", async () => {
    mockedPost.mockRejectedValueOnce(new Error("network"));
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useConfirmPayment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(paymentId).catch(() => {});
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
