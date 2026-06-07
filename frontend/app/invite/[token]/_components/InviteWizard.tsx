// Multi-step wizard that holds a single RHF form instance across all three steps.
// Per-step validation uses RHF's `trigger(fields)` so each Next button only surfaces
// errors for fields in that step, while final submission validates the full schema.
"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { InvitePreview } from "../_lib/invite";
import { STEP_FIELDS, type StepIndex, type WizardValues, wizardSchema } from "../_lib/schema";
import { useAcceptInvite } from "../_lib/useAcceptInvite";
import { StepIndicator } from "./StepIndicator";
import { ReviewStep } from "./ReviewStep";
import { AcceptStep } from "./AcceptStep";
import { AccountStep } from "./AccountStep";
import { SuccessStep } from "./SuccessStep";

interface InviteWizardProps {
    invite: InvitePreview;
}

export function InviteWizard({ invite }: InviteWizardProps) {
    const [step, setStep] = useState<StepIndex>(0);
    const [done, setDone] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const methods = useForm<WizardValues>({
        mode: "onBlur",
        resolver: zodResolver(wizardSchema),
        defaultValues: {
            signatureName: "",
            firstName: "",
            lastName: "",
            password: "",
            confirmPassword: "",
        },
    });

    const { handleSubmit, trigger } = methods;
    const { mutateAsync, isPending } = useAcceptInvite();

    async function handleNext(): Promise<void> {
        const fields = STEP_FIELDS[step];
        const valid = await trigger(fields, { shouldFocus: true });
        if (!valid) return;
        setStep((s) => (Math.min(s + 1, 2) as StepIndex));
    }

    function handleBack(): void {
        setStep((s) => (Math.max(s - 1, 0) as StepIndex));
    }

    const onValid = handleSubmit(async (values) => {
        setSubmitError(null);
        try {
            await mutateAsync({
                token: invite.token,
                firstName: values.firstName,
                lastName: values.lastName,
                password: values.password,
            });
            setDone(true);
        } catch {
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

    return (
        <Card className="max-w-2xl mx-auto">
            <StepIndicator current={step} />
            <form onSubmit={onValid} className="mt-6 space-y-6" noValidate>
                <FormProvider {...methods}>
                    {step === 0 && <ReviewStep invite={invite} />}
                    {step === 1 && <AcceptStep />}
                    {step === 2 && <AccountStep />}
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
                    {step < 2 ? (
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
        </Card>
    );
}
