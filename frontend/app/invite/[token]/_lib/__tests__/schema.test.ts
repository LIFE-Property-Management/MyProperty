import { wizardSchema, STEP_FIELDS, STEP_TITLES } from "../schema";

// The wizard schema is the rules engine for the new-user accept flow. These
// tests drive it directly (no DOM, no RHF) — one assertion per business rule, so
// a regression in any single rule surfaces here rather than silently in the UI.
// The signature + ID-document fields were removed (D6).

// A fully-valid set of values; individual tests override one field at a time.
function base(): Record<string, unknown> {
  return {
    acknowledgedLease: true,
    firstName: "Jane",
    lastName: "Doe",
    password: "secret123",
    confirmPassword: "secret123",
  };
}

function messagesFor(values: Record<string, unknown>): string[] {
  const result = wizardSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("wizardSchema", () => {
  it("accepts a fully-valid set of values", () => {
    expect(wizardSchema.safeParse(base()).success).toBe(true);
  });

  describe("acknowledgedLease", () => {
    it("rejects when the lease has not been acknowledged", () => {
      expect(messagesFor({ ...base(), acknowledgedLease: false })).toContain(
        "You must acknowledge the lease terms to continue",
      );
    });
  });

  describe("firstName / lastName", () => {
    it("rejects an empty first name", () => {
      expect(messagesFor({ ...base(), firstName: "" })).toContain(
        "First name is required",
      );
    });

    it("rejects a first name over 100 characters", () => {
      expect(messagesFor({ ...base(), firstName: "a".repeat(101) })).toContain(
        "First name must be 100 characters or fewer",
      );
    });

    it("rejects an empty last name", () => {
      expect(messagesFor({ ...base(), lastName: "" })).toContain(
        "Last name is required",
      );
    });
  });

  describe("password", () => {
    it("rejects fewer than 8 characters", () => {
      expect(messagesFor({ ...base(), password: "ab1", confirmPassword: "ab1" })).toContain(
        "Password must be at least 8 characters",
      );
    });

    it("rejects a password with no number", () => {
      expect(
        messagesFor({ ...base(), password: "abcdefgh", confirmPassword: "abcdefgh" }),
      ).toContain("Password must contain at least one number");
    });

    it("rejects a password with no letter", () => {
      expect(
        messagesFor({ ...base(), password: "12345678", confirmPassword: "12345678" }),
      ).toContain("Password must contain at least one letter");
    });
  });

  describe("confirmPassword", () => {
    it("rejects when the two passwords do not match", () => {
      expect(
        messagesFor({ ...base(), password: "secret123", confirmPassword: "secret124" }),
      ).toContain("Passwords do not match");
    });
  });
});

describe("step configuration", () => {
  it("maps each step to the fields validated on that step", () => {
    // The wizard relies on this mapping for per-step validation; if the schema
    // fields change without updating STEP_FIELDS, gating breaks silently.
    expect(STEP_FIELDS).toEqual([
      ["acknowledgedLease"],
      ["firstName", "lastName", "password", "confirmPassword"],
    ]);
  });

  it("has a title for each of the two steps", () => {
    expect(STEP_TITLES).toEqual(["Review lease", "Create account"]);
  });
});
