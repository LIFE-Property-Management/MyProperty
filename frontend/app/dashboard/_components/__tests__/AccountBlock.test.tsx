import { render, screen, fireEvent } from "@testing-library/react";
import { AccountBlock } from "../AccountBlock";

const mockSignOut = jest.fn();

// Mutable so each test can vary the profile name surfaced by useAuth. Reset to
// the no-name landlord default in beforeEach.
let mockAuthState: {
  user: { portal: "landlord"; sub: string; email: string } | null;
  firstName: string | null;
  lastName: string | null;
};

jest.mock("@/lib/hooks", () => ({
  useAuth: () => ({
    ...mockAuthState,
    isAuthenticated: true,
    isReadOnly: false,
    isMeLoading: false,
    signOut: mockSignOut,
  }),
}));

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

beforeEach(() => {
  mockSignOut.mockReset();
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  mockAuthState = {
    user: { portal: "landlord", sub: "u1", email: "landlord@dev.local" },
    firstName: null,
    lastName: null,
  };
});

describe("AccountBlock", () => {
  it("falls back to the email initial and email display name when no name is set", () => {
    render(<AccountBlock />);
    expect(screen.getByText("landlord@dev.local")).toBeInTheDocument();
    expect(screen.getByText("Landlord")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  it("derives avatar initials and display name from first + last name", () => {
    mockAuthState.firstName = "Drin";
    mockAuthState.lastName = "Prekaj";
    render(<AccountBlock />);
    expect(screen.getByText("DP")).toBeInTheDocument();
    expect(screen.getByText("Drin Prekaj")).toBeInTheDocument();
    // The email is no longer shown as the display name once a name exists.
    expect(screen.queryByText("landlord@dev.local")).toBeNull();
  });

  it("uses just the first-name initial when only the first name is present", () => {
    mockAuthState.firstName = "Drin";
    render(<AccountBlock />);
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.getByText("Drin")).toBeInTheDocument();
  });

  it("trigger has correct ARIA attributes when closed", () => {
    render(<AccountBlock />);
    const trigger = screen.getByRole("button", { name: /landlord/i });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("dropdown is not in the DOM when closed", () => {
    render(<AccountBlock />);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("clicking the trigger opens the dropdown", () => {
    render(<AccountBlock />);
    const trigger = screen.getByRole("button", { name: /landlord/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("when open, chevron-down is replaced by chevron-up", () => {
    render(<AccountBlock />);
    const trigger = screen.getByRole("button", { name: /landlord/i });
    expect(screen.getByTestId("account-chevron-down")).toBeInTheDocument();
    expect(screen.queryByTestId("account-chevron-up")).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByTestId("account-chevron-up")).toBeInTheDocument();
    expect(screen.queryByTestId("account-chevron-down")).toBeNull();
  });

  it("clicking the trigger again closes the dropdown", () => {
    render(<AccountBlock />);
    const trigger = screen.getByRole("button", { name: /landlord/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("pressing Escape while open closes the dropdown AND returns focus to trigger", () => {
    render(<AccountBlock />);
    const trigger = screen.getByRole("button", { name: /landlord/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("pressing Escape while closed does nothing", () => {
    render(<AccountBlock />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("clicking outside the component closes the dropdown", () => {
    render(<AccountBlock />);
    const trigger = screen.getByRole("button", { name: /landlord/i });
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("clicking the Sign out menu item calls signOut", () => {
    render(<AccountBlock />);
    const trigger = screen.getByRole("button", { name: /landlord/i });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("clicking Sign out closes the dropdown", () => {
    render(<AccountBlock />);
    const trigger = screen.getByRole("button", { name: /landlord/i });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
