import { render, screen, fireEvent } from "@testing-library/react";
import InviteRowActions from "../InviteRowActions";
import type { InviteListItem, InviteStatus } from "@/lib/types/landlord/invite";

const revoke = jest.fn();
const resend = jest.fn();
jest.mock("@/lib/hooks/useRevokeInvite", () => ({
  useRevokeInvite: () => ({ mutate: revoke, isPending: false, isError: false }),
}));
jest.mock("@/lib/hooks/useResendInvite", () => ({
  useResendInvite: () => ({ mutate: resend, isPending: false, isError: false }),
}));

const INVITE_ID = "02a00000-0000-7000-8000-0000000000a1";

function invite(status: InviteStatus): InviteListItem {
  return {
    id: INVITE_ID,
    propertyId: "02900000-0000-7000-8000-000000000001",
    propertyName: "Property 01",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    status,
    expiresAt: "2026-07-01T09:00:00Z",
    createdAt: "2026-06-10T09:00:00Z",
  };
}

beforeEach(() => {
  revoke.mockReset();
  resend.mockReset();
});

describe("<InviteRowActions />", () => {
  it.each(["Accepted", "Rejected", "Revoked"] as InviteStatus[])(
    "renders nothing for %s invites",
    (status) => {
      const { container } = render(<InviteRowActions invite={invite(status)} />);
      expect(container).toBeEmptyDOMElement();
    },
  );

  it.each(["Pending", "Expired"] as InviteStatus[])(
    "renders Resend and Revoke for %s invites",
    (status) => {
      render(<InviteRowActions invite={invite(status)} />);
      expect(screen.getByRole("button", { name: "Resend" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
    },
  );

  it("revokes the invite after confirming", () => {
    render(<InviteRowActions invite={invite("Pending")} />);
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(revoke).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /yes, revoke/i }));
    expect(revoke).toHaveBeenCalledWith(
      INVITE_ID,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("resends the invite after confirming", () => {
    render(<InviteRowActions invite={invite("Expired")} />);
    fireEvent.click(screen.getByRole("button", { name: "Resend" }));
    expect(resend).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /resend invitation/i }));
    expect(resend).toHaveBeenCalledWith(
      INVITE_ID,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
