import { render, screen } from "@testing-library/react";
import { ReadOnlyBanner } from "../ReadOnlyBanner";

jest.mock("../../../../lib/hooks", () => ({
  ...jest.requireActual("../../../../lib/hooks"),
  useAuth: jest.fn(),
}));

import { useAuth } from "../../../../lib/hooks";

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

beforeEach(() => {
  mockedUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    isReadOnly: false,
    isMeLoading: false,
    signOut: jest.fn(),
  });
});

describe("<ReadOnlyBanner />", () => {
  it("renders nothing when the tenant is Active (not read-only)", () => {
    const { container } = render(<ReadOnlyBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing while /me is loading", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: true,
      isReadOnly: false,
      isMeLoading: true,
      signOut: jest.fn(),
    });
    const { container } = render(<ReadOnlyBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders role='status' when the tenant is ReadOnly", () => {
    mockedUseAuth.mockReturnValue({
      user: { portal: "tenant", sub: "u1", email: "a@a.com" },
      isAuthenticated: true,
      isReadOnly: true,
      isMeLoading: false,
      signOut: jest.fn(),
    });
    render(<ReadOnlyBanner />);
    const alert = screen.getByRole("status");
    expect(alert).toHaveTextContent(/read-only/i);
  });
});
