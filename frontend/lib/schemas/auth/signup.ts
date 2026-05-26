import { z } from "zod";

export const signupSchema = z
    .object({
        firstName: z.string().trim().min(1, "First name is required"),
        lastName: z.string().trim().min(1, "Last name is required"),
        email: z.string().min(1, "Email is required").email("Enter a valid email"),
        phone: z.string().optional(),
        password: z.string().min(8, "Password must be at least 8 characters"),
        confirm: z.string().min(1, "Please confirm your password"),
    })
    .refine((data) => data.password === data.confirm, {
        message: "Passwords do not match",
        path: ["confirm"],
    });

export type SignupFormValues = z.infer<typeof signupSchema>;
