import { signupSchema } from "../signup";

const valid = {
    firstName: "John",
    lastName: "Smith",
    email: "john@example.com",
    password: "password123",
    confirm: "password123",
};

describe("signupSchema", () => {
    it("fails with required messages for all mandatory fields when all strings are empty", () => {
        // HTML forms always submit empty strings ("") for blank inputs, not undefined.
        // Zod v4 shows "Invalid input: expected string, received undefined" for missing keys;
        // the custom min(1) messages fire on "".
        const result = signupSchema.safeParse({
            firstName: "",
            lastName: "",
            email: "",
            password: "",
            confirm: "",
        });
        expect(result.success).toBe(false);
        if (result.success) return;
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain("First name is required");
        expect(messages).toContain("Last name is required");
        expect(messages).toContain("Email is required");
        expect(messages).toContain("Password must be at least 8 characters");
        expect(messages).toContain("Please confirm your password");
        // phone must NOT appear in error messages — it is optional
        const hasPhoneError = result.error.issues.some((i) => i.path.includes("phone"));
        expect(hasPhoneError).toBe(false);
    });

    it("fails with email format error for a non-email string", () => {
        const result = signupSchema.safeParse({ ...valid, email: "bad-email" });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.issues.map((i) => i.message)).toContain("Enter a valid email");
    });

    it("fails when password is shorter than 8 characters", () => {
        const result = signupSchema.safeParse({ ...valid, password: "short", confirm: "short" });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.issues.map((i) => i.message)).toContain(
            "Password must be at least 8 characters",
        );
    });

    it("fails when password and confirm do not match", () => {
        const result = signupSchema.safeParse({ ...valid, confirm: "different" });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.issues.map((i) => i.message)).toContain("Passwords do not match");
    });

    it("accepts phone as undefined", () => {
        const result = signupSchema.safeParse({ ...valid, phone: undefined });
        expect(result.success).toBe(true);
    });

    it("accepts phone as an empty string", () => {
        const result = signupSchema.safeParse({ ...valid, phone: "" });
        expect(result.success).toBe(true);
    });

    it("rejects whitespace-only firstName", () => {
        const result = signupSchema.safeParse({ ...valid, firstName: "   " });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.issues.map((i) => i.message)).toContain("First name is required");
    });

    it("rejects whitespace-only lastName", () => {
        const result = signupSchema.safeParse({ ...valid, lastName: "   " });
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.issues.map((i) => i.message)).toContain("Last name is required");
    });

    it("succeeds with a fully valid object", () => {
        expect(signupSchema.safeParse(valid).success).toBe(true);
    });

    it("succeeds with a fully valid object including a phone number", () => {
        expect(signupSchema.safeParse({ ...valid, phone: "+383 44 000 000" }).success).toBe(true);
    });
});
