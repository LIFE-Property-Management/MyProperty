"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { loginSchema, type LoginFormValues } from "@/lib/schemas/auth/login";
import { useLoginMutation } from "@/lib/hooks/auth/useLoginMutation";

export default function LoginPage() {
    const mutation = useLoginMutation();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = handleSubmit((data) => mutation.mutate(data));

    return (
        <Card padding="lg" className="w-full max-w-md">
            <h2 className="font-heading text-2xl font-semibold text-primary-text tracking-tight mb-1.5">
                Welcome back
            </h2>
            <p className="text-sm text-muted-text mb-7">
                Log in to your landlord account
            </p>

            <form onSubmit={onSubmit} noValidate className="space-y-4">
                <Input
                    label="Email address"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...register("email")}
                    error={errors.email?.message}
                />

                <div className="space-y-1">
                    <Input
                        label="Password"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...register("password")}
                        error={errors.password?.message}
                    />
                    <div className="flex justify-end">
                        <Link
                            href="/forgot-password"
                            className="text-sm text-primary font-medium hover:underline"
                        >
                            Forgot password?
                        </Link>
                    </div>
                </div>

                {mutation.isError && (
                    <p className="text-danger text-sm" role="alert">
                        {mutation.error.message}
                    </p>
                )}

                <Button type="submit" fullWidth isLoading={mutation.isPending}>
                    Log in
                </Button>
            </form>

            <p className="text-center text-sm text-muted-text mt-5">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-primary font-medium hover:underline">
                    Sign up
                </Link>
            </p>
        </Card>
    );
}
