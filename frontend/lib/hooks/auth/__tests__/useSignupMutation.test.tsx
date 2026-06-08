import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/test-utils/renderWithQuery";
import apiClient from "@/lib/api/client";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";
import type { SignupFormValues } from "@/lib/schemas/auth/signup";
import { useSignupMutation } from "../useSignupMutation";

// Tests the hook's own logic — request payload shaping and the success
// redirect — which the signup page test stubs out by mocking this hook.
// apiClient and the router are mocked so nothing real is hit. Mirrors the
// renderHook pattern in lib/hooks/__tests__/useAuth.test.tsx.
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock("@/lib/api/client", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

// Keep the real event taxonomy, spy on the emit. Asserts the funnel event fires
// without depending on PostHog being initialised (the facade no-ops in tests).
jest.mock("@/lib/analytics", () => ({
  __esModule: true,
  ...jest.requireActual("@/lib/analytics"),
  capture: jest.fn(),
}));

const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockedCapture = capture as jest.MockedFunction<typeof capture>;

function makeWrapper() {
  const client = makeQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryWrapper";
  return Wrapper;
}

function values(overrides: Partial<SignupFormValues> = {}): SignupFormValues {
  return {
    firstName: "John",
    lastName: "Smith",
    email: "john@example.com",
    phone: "+38344123456",
    password: "password123",
    confirm: "password123",
    ...overrides,
  };
}

beforeEach(() => {
  mockedPost.mockReset();
  mockPush.mockReset();
  mockedCapture.mockReset();
});

describe("useSignupMutation", () => {
  it("posts the registration payload and drops the confirm field", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useSignupMutation(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(values());
    });

    expect(mockedPost).toHaveBeenCalledWith("/auth/register-landlord", {
      email: "john@example.com",
      firstName: "John",
      lastName: "Smith",
      phone: "+38344123456",
      password: "password123",
    });
  });

  it("maps an empty phone to null", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useSignupMutation(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(values({ phone: "" }));
    });

    expect(mockedPost).toHaveBeenCalledWith(
      "/auth/register-landlord",
      expect.objectContaining({ phone: null }),
    );
  });

  it("redirects to the login page with the registered flag on success", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useSignupMutation(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(values());
    });

    expect(mockPush).toHaveBeenCalledWith("/login?registered=1");
  });

  it("does not redirect when the request fails", async () => {
    mockedPost.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useSignupMutation(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(values()).catch(() => {});
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("emits the signup_completed funnel event on success", async () => {
    mockedPost.mockResolvedValueOnce({ data: null });
    const { result } = renderHook(() => useSignupMutation(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(values());
    });

    expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.signupCompleted, {
      method: "email",
    });
  });

  it("does not emit the funnel event when the request fails", async () => {
    mockedPost.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useSignupMutation(), { wrapper: makeWrapper() });

    await act(async () => {
      await result.current.mutateAsync(values()).catch(() => {});
    });

    expect(mockedCapture).not.toHaveBeenCalled();
  });
});
