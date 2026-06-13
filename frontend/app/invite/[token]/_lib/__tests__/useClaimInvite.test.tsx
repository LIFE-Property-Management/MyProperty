import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import apiClient from "@/lib/api/client";
import { useClaimInvite } from "../useClaimInvite";

// Mirrors useAcceptInvite.test: verifies the claim hook posts to the token-scoped
// claim endpoint with NO body and redirects an already-authenticated tenant to
// their dashboard (not /login). apiClient + router are mocked.
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock("@/lib/api/client", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

function makeWrapper() {
  const client = makeQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryWrapper";
  return Wrapper;
}

beforeEach(() => {
  mockedPost.mockReset();
  mockPush.mockReset();
});

describe("useClaimInvite", () => {
  it("posts to the token-scoped claim endpoint with no body", async () => {
    mockedPost.mockResolvedValueOnce({ data: { inviteId: "i1", leaseId: "l1" } });
    const { result } = renderHook(() => useClaimInvite(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ token: "tok_123" });
    });

    expect(mockedPost).toHaveBeenCalledWith("/invites/tok_123/claim");
  });

  it("URL-encodes the token in the endpoint path", async () => {
    mockedPost.mockResolvedValueOnce({ data: { inviteId: "i1", leaseId: "l1" } });
    const { result } = renderHook(() => useClaimInvite(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ token: "a/b c" });
    });

    expect(mockedPost).toHaveBeenCalledWith("/invites/a%2Fb%20c/claim");
  });

  it("redirects to the tenant dashboard on success", async () => {
    mockedPost.mockResolvedValueOnce({ data: { inviteId: "i1", leaseId: "l1" } });
    const { result } = renderHook(() => useClaimInvite(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ token: "tok_123" });
    });

    expect(mockPush).toHaveBeenCalledWith("/tenant/dashboard");
  });

  it("does not redirect when the request fails", async () => {
    mockedPost.mockRejectedValueOnce(new Error("forbidden"));
    const { result } = renderHook(() => useClaimInvite(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ token: "tok_123" }).catch(() => {});
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
