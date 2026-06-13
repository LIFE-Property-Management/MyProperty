import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { InviteNotice } from "./InviteNotice";

interface EmailMismatchViewProps {
  invitedEmail: string;
}

// Shown when a signed-in visitor's email doesn't match the invite's recipient.
// The invite is a per-email bearer; we don't let a different account claim it.
// The visitor must sign in with the invited address (or ask for a new invite).
export function EmailMismatchView({ invitedEmail }: EmailMismatchViewProps) {
  return (
    <InviteNotice
      tone="danger"
      title="This invite is for a different account"
      action={
        <Link href="/">
          <Button variant="ghost">Back to home</Button>
        </Link>
      }
    >
      <p>
        This invitation was sent to{" "}
        <strong className="text-primary-text">{invitedEmail}</strong>, which doesn&apos;t match the
        account you&apos;re signed in with. Sign out and sign back in with the invited email, or ask
        your landlord to resend the invite to your current address.
      </p>
    </InviteNotice>
  );
}
