import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import apiClient from "@/lib/api/client";
import { useAcceptInvite, type AcceptInviteInput } from "../useAcceptInvite";

// Tests the hook's own logic — payload shaping, the token-scoped endpoint, and
// the success redirect — which the InviteWizard test stubs out by mocking this
// hook. The /login redirect here is the behaviour that makes the wizard's
// SuccessStep unreachable in production. apiClient + router are mocked.
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

function input(overrides: Partial<AcceptInviteInput> = {}): AcceptInviteInput {
  return {
    token: "tok_123",
    firstName: "Jane",
    lastName: "Doe",
    phone: "+38344999000",
    password: "secret123",
    ...overrides,
  };
}

beforeEach(() => {
  mockedPost.mockReset();
  mockPush.mockReset();
});

describe("useAcceptInvite", () => {
  it("posts the name/phone/password to the token-scoped accept endpoint", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useAcceptInvite(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(input());
    });

    // The token lives in the URL, not the body.
    expect(mockedPost).toHaveBeenCalledWith("/invites/tok_123/accept", {
      firstName: "Jane",
      lastName: "Doe",
      phone: "+38344999000",
      password: "secret123",
    });
  });

  it("maps a missing phone to null", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useAcceptInvite(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(input({ phone: undefined }));
    });

    expect(mockedPost).toHaveBeenCalledWith(
      "/invites/tok_123/accept",
      expect.objectContaining({ phone: null }),
    );
  });

  it("URL-encodes the token in the endpoint path", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useAcceptInvite(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(input({ token: "a/b c" }));
    });

    expect(mockedPost).toHaveBeenCalledWith("/invites/a%2Fb%20c/accept", expect.anything());
  });

  it("redirects to /login on success", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useAcceptInvite(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(input());
    });

    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("does not redirect when the request fails", async () => {
    mockedPost.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useAcceptInvite(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(input()).catch(() => {});
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});
