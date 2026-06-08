"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { signupSchema, type SignupFormValues } from "@/lib/schemas/auth/signup";
import { useSignupMutation } from "@/lib/hooks/auth/useSignupMutation";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";

export default function SignupPage() {
    const mutation = useSignupMutation();

    // Landlord activation funnel — step 1 (entered the signup form).
    useEffect(() => {
        capture(ANALYTICS_EVENTS.signupStarted);
    }, []);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<SignupFormValues>({
        resolver: zodResolver(signupSchema),
    });

    const onSubmit = handleSubmit((data) => mutation.mutate(data));

    return (
        <Card padding="lg" className="w-full max-w-md">
            <h2 className="font-heading text-2xl font-semibold text-primary-text tracking-tight mb-1.5">
                Create your account
            </h2>
            <p className="text-sm text-muted-text mb-7">
                Sign up as a landlord — free to get started
            </p>

            <form onSubmit={onSubmit} noValidate className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="First name"
                        placeholder="John"
                        autoComplete="given-name"
                        {...register("firstName")}
                        error={errors.firstName?.message}
                    />
                    <Input
                        label="Last name"
                        placeholder="Smith"
                        autoComplete="family-name"
                        {...register("lastName")}
                        error={errors.lastName?.message}
                    />
                </div>

                <Input
                    label="Email address"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...register("email")}
                    error={errors.email?.message}
                />

                <Input
                    label="Phone number"
                    type="tel"
                    placeholder="+383 44 000 000"
                    autoComplete="tel"
                    hint="Optional"
                    {...register("phone")}
                    error={errors.phone?.message}
                />

                <Input
                    label="Password"
                    type="password"
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    hint="At least 8 characters"
                    {...register("password")}
                    error={errors.password?.message}
                />

                <Input
                    label="Confirm password"
                    type="password"
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    {...register("confirm")}
                    error={errors.confirm?.message}
                />

                {mutation.isError && (
                    <p className="text-danger text-sm" role="alert">
                        {mutation.error.message}
                    </p>
                )}

                <Button type="submit" fullWidth isLoading={mutation.isPending}>
                    Create account
                </Button>
            </form>

            <p className="text-center text-sm text-muted-text mt-5">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">
                    Log in
                </Link>
            </p>

            <p className="text-xs text-muted-text mt-4 text-center">
                Are you a tenant? You&apos;ll receive an invite from your landlord by email —
                there&apos;s no self-signup for tenants.
            </p>
        </Card>
    );
}
