// New-user accept path: a two-step RHF form (Review → Create account) submitting
// the anonymous accept. A single form instance spans both steps; per-step
// validation uses RHF's `trigger(fields)`. If the backend reports the email
// already has an account (409), we switch to a sign-in CTA instead — that visitor
// is a returning tenant and should log in, then claim.
"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";
import { login } from "@/lib/auth/keycloak";
import type { InvitePreview } from "../_lib/invite";
import { STEP_FIELDS, type StepIndex, type WizardValues, wizardSchema } from "../_lib/schema";
import { useAcceptInvite } from "../_lib/useAcceptInvite";
import { StepIndicator } from "./StepIndicator";
import { ReviewStep } from "./ReviewStep";
import { AccountStep } from "./AccountStep";
import { SuccessStep } from "./SuccessStep";
import { InviteNotice } from "./InviteNotice";

interface NewUserAcceptFormProps {
  invite: InvitePreview;
  token: string;
}

export function NewUserAcceptForm({ invite, token }: NewUserAcceptFormProps) {
  const [step, setStep] = useState<StepIndex>(0);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);

  const methods = useForm<WizardValues>({
    mode: "onBlur",
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const { handleSubmit, trigger } = methods;
  const { mutateAsync, isPending } = useAcceptInvite();

  // Returning tenant who isn't signed in — bounce to Keycloak and come back to
  // this exact invite, where the now-authenticated claim path takes over.
  function handleSignIn(): void {
    void login(`${window.location.origin}/invite/${token}`);
  }

  async function handleNext(): Promise<void> {
    const fields = STEP_FIELDS[step];
    const valid = await trigger(fields, { shouldFocus: true });
    if (!valid) return;
    // Tenant onboarding funnel — step 2 (advanced past the lease review step).
    if (step === 0) capture(ANALYTICS_EVENTS.leaseReviewed);
    setStep((s) => (Math.min(s + 1, 1) as StepIndex));
  }

  function handleBack(): void {
    setStep((s) => (Math.max(s - 1, 0) as StepIndex));
  }

  const onValid = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await mutateAsync({
        token,
        firstName: values.firstName,
        lastName: values.lastName,
        password: values.password,
      });
      setDone(true);
    } catch (err) {
      // 409 = an account already exists for this email. Don't treat it as a
      // failure — route the returning tenant to sign in.
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setExistingAccount(true);
        return;
      }
      setSubmitError("We couldn't submit your acceptance. Please try again.");
    }
  });

  if (done) {
    return (
      <Card className="max-w-xl mx-auto">
        <SuccessStep email={invite.tenantEmail} />
      </Card>
    );
  }

  if (existingAccount) {
    return (
      <InviteNotice
        tone="neutral"
        title="You already have an account"
        action={
          <Button variant="primary" onClick={handleSignIn}>
            Go to sign in
          </Button>
        }
      >
        <p>
          An account for <strong className="text-primary-text">{invite.tenantEmail}</strong> already
          exists. Sign in and you&apos;ll be brought right back here to accept this invite.
        </p>
      </InviteNotice>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <StepIndicator current={step} />
      <form onSubmit={onValid} className="mt-6 space-y-6" noValidate>
        <FormProvider {...methods}>
          {step === 0 && <ReviewStep invite={invite} />}
          {step === 1 && <AccountStep />}
        </FormProvider>

        {submitError && (
          <p className="text-sm text-danger" role="alert">
            {submitError}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            disabled={step === 0 || isPending}
          >
            Back
          </Button>
          {step < 1 ? (
            <Button type="button" variant="primary" onClick={handleNext}>
              Continue
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Submitting…" : "Accept & create account"}
            </Button>
          )}
        </div>
      </form>

      <p className="mt-6 border-t border-border pt-4 text-center text-sm text-muted-text">
        Already have an account?{" "}
        <button
          type="button"
          onClick={handleSignIn}
          className="font-medium text-primary transition-colors duration-150 hover:text-primary-dark focus-visible:outline-none focus-visible:underline"
        >
          Sign in
        </button>
      </p>
    </Card>
  );
}
