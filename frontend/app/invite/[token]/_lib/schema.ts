import { z } from "zod";

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[A-Za-z]/, "Password must contain at least one letter");

// New-user accept form. The signature + ID-document step was removed (D6) — the
// backend never received those fields. A returning, logged-in tenant claims the
// invite without this form (no password); see InviteWizard's claim path.
export const wizardSchema = z
  .object({
    acknowledgedLease: z.literal(true, {
      message: "You must acknowledge the lease terms to continue",
    }),
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(100, "First name must be 100 characters or fewer"),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(100, "Last name must be 100 characters or fewer"),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type WizardValues = z.infer<typeof wizardSchema>;

// Fields validated on each step of the new-user flow (Review → Create account).
export const STEP_FIELDS = [
  ["acknowledgedLease"],
  ["firstName", "lastName", "password", "confirmPassword"],
] as const satisfies ReadonlyArray<ReadonlyArray<keyof WizardValues>>;

export type StepIndex = 0 | 1;

export const STEP_TITLES = ["Review lease", "Create account"] as const;
