"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { login } from "@/lib/auth/keycloak";

export default function LoginPage() {
    const params = useSearchParams();
    const registered = params.get("registered") === "1";

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
