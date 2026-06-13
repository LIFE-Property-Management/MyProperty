import { render, screen } from "@testing-library/react";
import { InviteStatusView } from "../InviteStatusView";

// Each non-Pending status renders its own copy + CTA. Accepted routes the
// returning tenant to sign in; the rest are dead ends back to home.
describe("InviteStatusView", () => {
  it("routes an Accepted invite to sign in", () => {
    render(<InviteStatusView status="Accepted" />);

    expect(screen.getByRole("heading", { name: /already accepted/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it.each([
    ["Rejected", /declined/i],
    ["Expired", /expired/i],
    ["Revoked", /cancelled/i],
  ] as const)("shows a back-to-home dead end for a %s invite", (status, heading) => {
    render(<InviteStatusView status={status} />);

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
  });
});
