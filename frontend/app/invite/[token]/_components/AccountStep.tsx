"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import type { WizardValues } from "../_lib/schema";

export function AccountStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<WizardValues>();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-heading text-xl text-primary-text">Create your account</h2>
        <p className="mt-1 text-sm text-muted-text">
          Set a password so you can sign in and manage your lease from the tenant portal.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="First name"
          placeholder="Jane"
          autoComplete="given-name"
          error={errors.firstName?.message}
          {...register("firstName")}
        />
        <Input
          label="Last name"
          placeholder="Doe"
          autoComplete="family-name"
          error={errors.lastName?.message}
          {...register("lastName")}
        />
      </div>

      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, with a letter and a number."
        error={errors.password?.message}
        {...register("password")}
      />

      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
    </div>
  );
}
