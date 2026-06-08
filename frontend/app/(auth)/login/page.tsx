"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { initKeycloak, login } from "@/lib/auth/keycloak";
import useAuthStore from "@/lib/store/auth/useAuthStore";

export default function LoginPage() {
    const params = useSearchParams();
    const registered = params.get("registered") === "1";
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const [initializing, setInitializing] = useState(true);

    // Keycloak's standard-flow callback returns the browser here (login()
    // redirects to /login). initKeycloak parses the callback, validates the
    // token, and populates the auth store. Running it here is what routes the
    // user to their portal after sign-in; without it the callback would sit on
    // /#state=…&code=… forever. initKeycloak is idempotent.
    useEffect(() => {
        let active = true;
        initKeycloak().finally(() => {
            if (active) setInitializing(false);
        });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!user) return;
        if (user.portal === "landlord") {
            router.replace("/dashboard");
        } else if (user.portal === "tenant") {
            router.replace("/tenant/dashboard");
        } else if (user.portal === "admin") {
            router.replace("/admin/dashboard");
        }
    }, [user, router]);

    if (initializing) {
        return (
            <Card padding="lg" className="w-full max-w-md">
                <p className="text-sm text-muted-text" role="status">
                    Signing you in…
                </p>
            </Card>
        );
    }

    // landlord / tenant / admin are being redirected by the effect above; render
    // the redirecting state rather than flashing the sign-in button.
    if (user) {
        return (
            <Card padding="lg" className="w-full max-w-md">
                <p className="text-sm text-muted-text" role="status">
                    Redirecting…
                </p>
            </Card>
        );
    }

    return (
        <Card padding="lg" className="w-full max-w-md">
            <h2 className="font-heading text-2xl font-semibold text-primary-text tracking-tight mb-1.5">
                Welcome back
            </h2>
            <p className="text-sm text-muted-text mb-7">
                Log in to your MyProperty account
            </p>

            {registered && (
                <p className="text-sm text-primary bg-primary-light rounded-md px-4 py-3 mb-5" role="status">
                    Account created — please log in to continue.
                </p>
            )}

            <Button fullWidth onClick={() => login()}>
                Continue to sign-in
            </Button>

            <p className="text-center text-sm text-muted-text mt-5">
                New here?{" "}
                <Link href="/signup" className="text-primary font-medium hover:underline">
                    Create a landlord account
                </Link>
            </p>
        </Card>
    );
}
