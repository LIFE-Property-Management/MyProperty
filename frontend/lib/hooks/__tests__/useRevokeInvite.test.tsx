import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import apiClient from "@/lib/api/client";
import { queryKeys } from "../queryKeys";
import { useRevokeInvite } from "../useRevokeInvite";

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

const inviteId = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  mockedPost.mockReset();
});

describe("useRevokeInvite", () => {
  it("posts to the revoke endpoint for the given invite id", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRevokeInvite(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(inviteId);
    });

    expect(mockedPost).toHaveBeenCalledWith(`/invites/${inviteId}/revoke`);
  });

  it("invalidates the invite, property, and dashboard caches on success", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useRevokeInvite(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(inviteId);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.invites.all() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.property.all() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.landlord.dashboard() });
  });

  it("does not invalidate caches when the request fails", async () => {
    mockedPost.mockRejectedValueOnce(new Error("network"));
    const { Wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useRevokeInvite(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(inviteId).catch(() => {});
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
