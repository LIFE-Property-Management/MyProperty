"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { resetPassword } from "@/lib/auth/keycloak";

// Self-serve password recovery. Like the login page, this hands off to
// Keycloak's hosted flow rather than reimplementing it: the button sends the
// user to Keycloak's reset-credentials page, which collects their email, mails
// a reset link, and hosts the new-password form. There is no in-app
// /reset-password route — the emailed link lands on Keycloak's own page.
export default function ForgotPasswordPage() {
    return (
        <Card padding="lg" className="w-full max-w-md">
            <h2 className="font-heading text-2xl font-semibold text-primary-text tracking-tight mb-1.5">
                Reset your password
            </h2>
            <p className="text-sm text-muted-text mb-7">
                We&apos;ll take you to a secure page to enter your email address. If an
                account exists, you&apos;ll receive a link to set a new password.
            </p>

            <Button fullWidth onClick={() => resetPassword()}>
                Continue to password reset
            </Button>

            <p className="text-center text-sm text-muted-text mt-5">
                Remembered it?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">
                    Back to log in
                </Link>
            </p>
        </Card>
    );
}
