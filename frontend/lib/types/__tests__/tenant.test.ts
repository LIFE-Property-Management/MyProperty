import { tenantAccountSchema } from "../tenant";

const BASE = {
  id: "0193b42d-df5a-7f2a-8c3b-e2f8a97c1456",
  email: "tenant@dev.local",
  firstName: "Ava",
  lastName: "Shala",
  phone: "+38349123456",
  accountStatus: "Active" as const,
  hasActiveLease: true,
  createdAt: "2024-04-15T10:30:00Z",
};

describe("tenantAccountSchema", () => {
  it("accepts a valid active tenant", () => {
    expect(() => tenantAccountSchema.parse(BASE)).not.toThrow();
  });

  it("accepts null phone (optional on the account)", () => {
    expect(() => tenantAccountSchema.parse({ ...BASE, phone: null })).not.toThrow();
  });

  it("accepts ReadOnly account status with hasActiveLease=false", () => {
    expect(() =>
      tenantAccountSchema.parse({
        ...BASE,
        accountStatus: "ReadOnly",
        hasActiveLease: false,
      }),
    ).not.toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => tenantAccountSchema.parse({ ...BASE, email: "not-an-email" })).toThrow();
  });

  it("rejects empty firstName / lastName", () => {
    expect(() => tenantAccountSchema.parse({ ...BASE, firstName: "" })).toThrow();
    expect(() => tenantAccountSchema.parse({ ...BASE, lastName: "" })).toThrow();
  });

  it("rejects a date-only string for createdAt (must be full ISO 8601)", () => {
    expect(() =>
      tenantAccountSchema.parse({ ...BASE, createdAt: "2024-04-15" }),
    ).toThrow();
  });

  it("rejects unknown accountStatus (e.g. Deleted — portals.md forbids)", () => {
    expect(() =>
      tenantAccountSchema.parse({ ...BASE, accountStatus: "Deleted" }),
    ).toThrow();
  });
});
