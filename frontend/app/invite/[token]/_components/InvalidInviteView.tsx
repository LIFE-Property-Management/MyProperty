import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { InviteNotice } from "./InviteNotice";

// Shown when the token doesn't resolve to any invite (backend 404) or the
// preview can't be loaded at all. We deliberately keep the copy generic and
// never confirm whether a token exists.
export function InvalidInviteView() {
  return (
    <InviteNotice
      tone="neutral"
      title="This invite link isn't valid"
      action={
        <Link href="/">
          <Button variant="primary">Back to home</Button>
        </Link>
      }
    >
      <p>
        We couldn&apos;t open this invite. The link may be incorrect or no longer active. Check that
        you used the full link from your email, or ask your landlord to resend the invitation.
      </p>
    </InviteNotice>
  );
}
