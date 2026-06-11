import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import PropertyOccupancyAction from "../PropertyOccupancyAction";

// Mutation hooks — capture mutate so we can assert the id and trigger onSuccess.
const terminate = jest.fn();
const revoke = jest.fn();
let terminateIsError = false;
jest.mock("@/lib/hooks/useTerminateLease", () => ({
  useTerminateLease: () => ({ mutate: terminate, isPending: false, isError: terminateIsError }),
}));
jest.mock("@/lib/hooks/useRevokeInvite", () => ({
  useRevokeInvite: () => ({ mutate: revoke, isPending: false, isError: false }),
}));

// Keep the real ANALYTICS_EVENTS names; stub capture.
const capture = jest.fn();
jest.mock("@/lib/analytics", () => ({
  __esModule: true,
  capture: (...args: unknown[]) => capture(...args),
  ANALYTICS_EVENTS: jest.requireActual("@/lib/analytics/events").ANALYTICS_EVENTS,
}));

jest.mock("next/link", () => {
  const MockLink = ({ children, href, ...props }: { children: ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

const PROPERTY_ID = "02900000-0000-7000-8000-000000000001";
const LEASE_ID = "02900000-0000-7000-8000-00000000a001";
const INVITE_ID = "02900000-0000-7000-8000-00000000b002";

beforeEach(() => {
  terminate.mockReset();
  revoke.mockReset();
  capture.mockReset();
  terminateIsError = false;
});

describe("<PropertyOccupancyAction />", () => {
  describe("vacant", () => {
    it("renders an Add lease link to the create-invite route and fires tenant_invite_started", () => {
      render(
        <PropertyOccupancyAction
          propertyId={PROPERTY_ID}
          hasActiveLease={false}
          hasPendingInvite={false}
          activeLeaseId={null}
          pendingInviteId={null}
        />,
      );
      const link = screen.getByRole("link", { name: /add lease/i });
      expect(link).toHaveAttribute(
        "href",
        `/dashboard/invites/new?propertyId=${PROPERTY_ID}`,
      );

      fireEvent.click(link);
      expect(capture).toHaveBeenCalledWith("tenant_invite_started", { propertyId: PROPERTY_ID });
    });
  });

  describe("leased", () => {
    it("terminates the active lease after confirming", () => {
      render(
        <PropertyOccupancyAction
          propertyId={PROPERTY_ID}
          hasActiveLease={true}
          hasPendingInvite={false}
          activeLeaseId={LEASE_ID}
          pendingInviteId={null}
        />,
      );
      // Opens the confirm modal — nothing terminated yet.
      fireEvent.click(screen.getByRole("button", { name: "Cancel lease" }));
      expect(terminate).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: /yes, cancel lease/i }));
      expect(terminate).toHaveBeenCalledWith(
        LEASE_ID,
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("does not render the pending or vacant actions", () => {
      render(
        <PropertyOccupancyAction
          propertyId={PROPERTY_ID}
          hasActiveLease={true}
          hasPendingInvite={false}
          activeLeaseId={LEASE_ID}
          pendingInviteId={null}
        />,
      );
      expect(screen.queryByRole("link", { name: /add lease/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/invitation pending/i)).not.toBeInTheDocument();
    });
  });

  describe("invite pending", () => {
    it("shows the pending badge and revokes the invite after confirming", () => {
      render(
        <PropertyOccupancyAction
          propertyId={PROPERTY_ID}
          hasActiveLease={false}
          hasPendingInvite={true}
          activeLeaseId={null}
          pendingInviteId={INVITE_ID}
        />,
      );
      expect(screen.getByText(/invitation pending/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Cancel invitation" }));
      expect(revoke).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: /yes, cancel invitation/i }));
      expect(revoke).toHaveBeenCalledWith(
        INVITE_ID,
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("falls back to a Manage link when no pending invite id is available", () => {
      render(
        <PropertyOccupancyAction
          propertyId={PROPERTY_ID}
          hasActiveLease={false}
          hasPendingInvite={true}
          activeLeaseId={null}
          pendingInviteId={null}
        />,
      );
      expect(screen.getByText(/invitation pending/i)).toBeInTheDocument();
      const manage = screen.getByRole("link", { name: /manage/i });
      expect(manage).toHaveAttribute("href", "/dashboard/invites");
      expect(screen.queryByRole("button", { name: /cancel invitation/i })).not.toBeInTheDocument();
    });
  });
});
