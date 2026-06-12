"use client";

import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { usePreviewInvite } from "../_lib/usePreviewInvite";
import { useOptionalKeycloak } from "../_lib/useOptionalKeycloak";
import { InvalidInviteView } from "./InvalidInviteView";
import { InviteStatusView } from "./InviteStatusView";
import { InviteWizard } from "./InviteWizard";

interface InviteFlowProps {
  token: string;
}

// Client entry point for the invite-accept flow. The server component (page.tsx)
// only resolves the route token; here we fetch the live preview and the visitor's
// auth state (both client-only) to decide what to render. Status branching lands
// in InviteWizard's gate (Step 2).
export function InviteFlow({ token }: InviteFlowProps) {
  // Detect an existing session before branching the wizard (the claim path keys
  // off it). Non-gating: anonymous visitors fall through to the new-user path.
  const authReady = useOptionalKeycloak();
  const { data: invite, isPending, isError } = usePreviewInvite(token);

  if (!authReady || isPending) {
    return (
      <Card className="mx-auto max-w-xl">
        <div className="flex items-center justify-center py-10">
          <Spinner size="lg" label="Loading your invite" />
        </div>
      </Card>
    );
  }

  // A 404 (unknown token) or any other load failure both render the same
  // generic "invalid link" view — we never confirm whether a token exists.
  if (isError) {
    return <InvalidInviteView />;
  }

  // The backend returns 200 with the real status for any resolved invite. Only a
  // Pending invite is actionable; every other state gets a friendly dead-end view
  // (a Pending-but-past-expiry invite is reported as Expired by the backend).
  if (invite.status !== "Pending") {
    return <InviteStatusView status={invite.status} />;
  }

  return <InviteWizard invite={invite} token={token} />;
}
