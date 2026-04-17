"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import type { WizardValues } from "../_lib/schema";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AcceptStep() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<WizardValues>();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-heading text-xl text-primary-text">Accept and verify</h2>
        <p className="mt-1 text-sm text-muted-text">
          Type your legal name as your signature and upload a government-issued ID for
          verification. Your landlord confirms the lease after reviewing your ID.
        </p>
      </header>

      <Input
        label="Signature (type your legal name)"
        placeholder="e.g. Jane Q. Doe"
        autoComplete="name"
        error={errors.signatureName?.message}
        {...register("signatureName")}
      />

      <Controller
        control={control}
        name="idDocument"
        render={({ field, fieldState }) => {
          const file = field.value as File | undefined;
          return (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="idDocument"
                className="text-sm font-medium text-primary-text"
              >
                ID document (JPEG, PNG, or PDF — max 5MB)
              </label>
              <input
                id="idDocument"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onBlur={field.onBlur}
                onChange={(e) => field.onChange(e.target.files?.[0])}
                aria-invalid={fieldState.error ? "true" : "false"}
                aria-describedby={fieldState.error ? "idDocument-error" : "idDocument-hint"}
                className="block w-full text-sm text-primary-text
                           file:mr-4 file:rounded-md file:border-0 file:bg-primary
                           file:px-4 file:py-2 file:text-sm file:font-medium file:text-white
                           hover:file:bg-primary-dark
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              {file ? (
                <p id="idDocument-hint" className="text-xs text-muted-text">
                  Selected: <span className="font-medium">{file.name}</span> ({formatBytes(file.size)})
                </p>
              ) : (
                <p id="idDocument-hint" className="text-xs text-muted-text">
                  We only share this with your landlord for verification.
                </p>
              )}
              {fieldState.error && (
                <p id="idDocument-error" className="text-xs text-danger" role="alert">
                  {fieldState.error.message}
                </p>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
