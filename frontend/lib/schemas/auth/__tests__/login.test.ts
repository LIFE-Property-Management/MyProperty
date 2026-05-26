import { loginSchema } from "../login";

describe("loginSchema", () => {
    it("fails with required messages when both fields are empty", () => {
        const result = loginSchema.safeParse({ email: "", password: "" });
        expect(result.success).toBe(false);
        if (result.success) return;
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain("Email is required");
        expect(messages).toContain("Password is required");
    });

    it("fails with email format error for a non-email string", () => {
        const result = loginSchema.safeParse({ email: "not-an-email", password: "x" });
        expect(result.success).toBe(false);
        if (result.success) return;
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain("Enter a valid email");
    });

    it("succeeds with a valid email and any non-empty password", () => {
        const result = loginSchema.safeParse({ email: "a@b.co", password: "x" });
        expect(result.success).toBe(true);
    });
});
