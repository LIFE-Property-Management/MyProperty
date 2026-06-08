import { render, screen, waitFor } from "@testing-library/react";
import type { DecodedPayload } from "@/lib/store/auth/useAuthStore";

// Controlled auth state — each test sets mockUser before rendering.
let mockUser: DecodedPayload | null = null;
const setAuthMock = jest.fn();

jest.mock("@/lib/store/auth/useAuthStore", () => ({
  __esModule: true,
  default: { getState: () => ({ user: mockUser, setAuth: setAuthMock }) },
}));

jest.mock("@/lib/auth/keycloak", () => ({
  initKeycloak: jest.fn(() => Promise.resolve()),
}));

const replaceMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

import KeycloakInit from "../KeycloakInit";

beforeEach(() => {
  mockUser = null;
  replaceMock.mockReset();
  setAuthMock.mockReset();
});

describe("admin <KeycloakInit />", () => {
  it("redirects a non-admin portal to /login and does not render children", async () => {
    mockUser = { portal: "landlord", sub: "u1", email: "landlord@dev.local" };
    render(
      <KeycloakInit>
        <div>admin content</div>
      </KeycloakInit>,
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("admin content")).not.toBeInTheDocument();
  });

  it("redirects to /login when there is no session", async () => {
    mockUser = null;
    render(
      <KeycloakInit>
        <div>admin content</div>
      </KeycloakInit>,
    );
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("admin content")).not.toBeInTheDocument();
  });

  it("renders children for an admin session without redirecting", async () => {
    mockUser = { portal: "admin", sub: "a1", email: "admin@dev.local" };
    render(
      <KeycloakInit>
        <div>admin content</div>
      </KeycloakInit>,
    );
    await waitFor(() => expect(screen.getByText("admin content")).toBeInTheDocument());
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
