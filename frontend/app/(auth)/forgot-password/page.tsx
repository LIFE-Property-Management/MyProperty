// TODO(auth): implement password reset flow.
// Depends on:
//   - A backend endpoint (e.g. POST /api/v1/auth/forgot-password) that triggers
//     a Keycloak "reset credentials" email for the given email address.
//   - Or: redirect to Keycloak's built-in "Forgot password?" URL directly.
//       Format: {KEYCLOAK_URL}/realms/{REALM}/login-actions/reset-credentials?client_id={CLIENT_ID}
//   - A /reset-password?token=... page that accepts the token from the email
//     and calls POST /api/v1/auth/reset-password or Keycloak's action token flow.
// Until implemented, this page shows a holding message.

import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function ForgotPasswordPage() {
    return (
        <Card padding="lg" className="w-full max-w-md text-center">
            <div className="mb-4 flex justify-center">
                <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                            fill="currentColor"
                            className="text-primary"
                        />
                    </svg>
                </div>
            </div>

            <h2 className="font-heading text-2xl font-semibold text-primary-text tracking-tight mb-3">
                Reset your password
            </h2>
            <p className="text-sm text-muted-text mb-6">
                Password reset is coming soon. Please contact your landlord or our support team if
                you&apos;ve lost access to your account.
            </p>

            <Link
                href="/login"
                className="text-sm text-primary font-medium hover:underline"
            >
                ← Back to log in
            </Link>
        </Card>
    );
}
