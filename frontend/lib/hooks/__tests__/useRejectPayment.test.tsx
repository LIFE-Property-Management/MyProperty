import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import apiClient from "@/lib/api/client";
import { queryKeys } from "../queryKeys";
import { useRejectPayment } from "../useRejectPayment";

// Tests the hook's own logic — the reject POST (URL + `{ reason }` body) and the
// cache invalidation it triggers on success. apiClient is mocked so nothing real
// is hit. Mirrors lib/hooks/auth/__tests__/useSignupMutation.test.tsx.
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

const paymentId = "22222222-2222-2222-2222-222222222222";
const reason = "Receipt amount does not match the rent due.";

beforeEach(() => {
  mockedPost.mockReset();
});

describe("useRejectPayment", () => {
  it("posts the reason to the reject endpoint for the given payment id", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRejectPayment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ paymentId, reason });
    });

    expect(mockedPost).toHaveBeenCalledWith(`/payments/${paymentId}/reject`, { reason });
  });

  it("invalidates the payment, dashboard, and tenant caches on success", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useRejectPayment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ paymentId, reason });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.payment.all() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.dashboard() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.tenant.all() });
  });

  it("does not invalidate caches when the request fails", async () => {
    mockedPost.mockRejectedValueOnce(new Error("network"));
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useRejectPayment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ paymentId, reason }).catch(() => {});
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
