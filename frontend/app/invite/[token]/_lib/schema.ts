import { z } from "zod";

const MAX_ID_BYTES = 5 * 1024 * 1024;
const ID_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[A-Za-z]/, "Password must contain at least one letter");

export const wizardSchema = z
  .object({
    acknowledgedLease: z.literal(true, {
      message: "You must acknowledge the lease terms to continue",
    }),
    signatureName: z
      .string()
      .min(2, "Signature must be at least 2 characters")
      .max(120, "Signature must be 120 characters or fewer"),
    idDocument: z
      .instanceof(File, { message: "An ID document is required" })
      .refine((f) => f.size <= MAX_ID_BYTES, "File must be 5MB or smaller")
      .refine(
        (f) => (ID_MIME as readonly string[]).includes(f.type),
        "File must be JPEG, PNG, or PDF",
      ),
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(120, "Full name must be 120 characters or fewer"),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type WizardValues = z.infer<typeof wizardSchema>;

export const STEP_FIELDS = [
  ["acknowledgedLease"],
  ["signatureName", "idDocument"],
  ["fullName", "password", "confirmPassword"],
] as const satisfies ReadonlyArray<ReadonlyArray<keyof WizardValues>>;

export type StepIndex = 0 | 1 | 2;

export const STEP_TITLES = [
  "Review lease",
  "Accept & verify",
  "Create account",
] as const;
