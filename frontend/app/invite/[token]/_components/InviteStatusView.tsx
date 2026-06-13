import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { InviteStatus } from "@/lib/types/landlord/invite";
import { InviteNotice } from "./InviteNotice";

// Every invite state except Pending is non-actionable — the wizard never renders
// for these. Each gets a friendly, specific view. Accepted points to login (the
// invitee now has — or can use — an account); the rest are dead ends back home.
type ResolvedStatus = Exclude<InviteStatus, "Pending">;

interface InviteStatusViewProps {
  status: ResolvedStatus;
}

const BackHome = (
  <Link href="/">
    <Button variant="ghost">Back to home</Button>
  </Link>
);

const GoToLogin = (
  <Link href="/login">
    <Button variant="primary">Go to sign in</Button>
  </Link>
);

export function InviteStatusView({ status }: InviteStatusViewProps) {
  switch (status) {
    case "Accepted":
      return (
        <InviteNotice tone="success" title="This invite was already accepted" action={GoToLogin}>
          <p>
            Your lease is set up. Sign in to your tenant portal to view it and manage your tenancy.
          </p>
        </InviteNotice>
      );
    case "Rejected":
      return (
        <InviteNotice tone="neutral" title="This invite was declined" action={BackHome}>
          <p>
            This invitation was previously declined. If that was a mistake, ask your landlord to
            send a new invite.
          </p>
        </InviteNotice>
      );
    case "Expired":
      return (
        <InviteNotice tone="neutral" title="This invite has expired" action={BackHome}>
          <p>
            Invitations are valid for a limited time. Ask your landlord to resend the invitation and
            you&apos;ll get a fresh link.
          </p>
        </InviteNotice>
      );
    case "Revoked":
      return (
        <InviteNotice tone="neutral" title="This invite was cancelled" action={BackHome}>
          <p>
            Your landlord cancelled this invitation. If you think this is a mistake, get in touch
            with them to send a new one.
          </p>
        </InviteNotice>
      );
  }
}
