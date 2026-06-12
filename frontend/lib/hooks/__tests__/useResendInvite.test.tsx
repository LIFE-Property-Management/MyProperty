import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import apiClient from "@/lib/api/client";
import { queryKeys } from "../queryKeys";
import { useResendInvite } from "../useResendInvite";

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

const inviteId = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
  mockedPost.mockReset();
});

describe("useResendInvite", () => {
  it("posts to the resend endpoint for the given invite id", async () => {
    mockedPost.mockResolvedValueOnce({ data: { inviteId, expiresAt: "2030-02-01T00:00:00Z" } });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useResendInvite(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(inviteId);
    });

    expect(mockedPost).toHaveBeenCalledWith(`/invites/${inviteId}/resend`);
  });

  it("invalidates invites, properties, and the dashboard on success", async () => {
    // Resending an Expired invite flips it back to effective-pending, which
    // changes property occupancy — so the property + dashboard caches must
    // refresh too, mirroring useRevokeInvite in reverse.
    mockedPost.mockResolvedValueOnce({ data: {} });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useResendInvite(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(inviteId);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.invites.all() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.property.all() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.dashboard() });
    expect(invalidateSpy).toHaveBeenCalledTimes(3);
  });

  it("does not invalidate caches when the request fails", async () => {
    mockedPost.mockRejectedValueOnce(new Error("network"));
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useResendInvite(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(inviteId).catch(() => {});
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
