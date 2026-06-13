// Three-case router for a Pending invite (the actionable state). Detection of the
// signed-in case uses useAuth() (the Keycloak token lives client-side):
//   • signed in, email matches invite  → ClaimConfirm (authenticated claim, no password)
//   • signed in, email differs          → EmailMismatchView
//   • not signed in                      → NewUserAcceptForm (anonymous accept; also
//     offers sign-in for returning tenants, and handles the 409 "already exists" case)
"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";
import type { InvitePreview } from "../_lib/invite";
import { NewUserAcceptForm } from "./NewUserAcceptForm";
import { ClaimConfirm } from "./ClaimConfirm";
import { EmailMismatchView } from "./EmailMismatchView";

interface InviteWizardProps {
  invite: InvitePreview;
  token: string;
}

export function InviteWizard({ invite, token }: InviteWizardProps) {
  const { user, isAuthenticated } = useAuth();

  // Tenant onboarding funnel — invite link opened (fires once, regardless of case).
  useEffect(() => {
    capture(ANALYTICS_EVENTS.inviteOpened);
  }, []);

  if (isAuthenticated) {
    const emailMatches =
      (user?.email ?? "").toLowerCase() === invite.tenantEmail.toLowerCase();
    if (!emailMatches) {
      return <EmailMismatchView invitedEmail={invite.tenantEmail} />;
    }
    return <ClaimConfirm invite={invite} token={token} />;
  }

  return <NewUserAcceptForm invite={invite} token={token} />;
}
