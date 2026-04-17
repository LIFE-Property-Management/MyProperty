import {
  paymentStatusSchema,
  paymentMethodSchema,
  leaseStatusSchema,
  tenantAccountStatusSchema,
} from "../enums";

describe("paymentStatusSchema", () => {
  it.each(["Outstanding", "Pending", "Confirmed", "Rejected"])("accepts %s", (value) => {
    expect(paymentStatusSchema.parse(value)).toBe(value);
  });

  it("rejects unknown status", () => {
    expect(() => paymentStatusSchema.parse("Late")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => paymentStatusSchema.parse("")).toThrow();
  });
});

describe("paymentMethodSchema", () => {
  it.each(["ReceiptUpload", "ManualRequest"])("accepts %s", (value) => {
    expect(paymentMethodSchema.parse(value)).toBe(value);
  });

  it("rejects Cash (similar but wrong)", () => {
    expect(() => paymentMethodSchema.parse("Cash")).toThrow();
  });
});

describe("leaseStatusSchema", () => {
  it.each(["Active", "Expired", "Terminated"])("accepts %s", (value) => {
    expect(leaseStatusSchema.parse(value)).toBe(value);
  });

  it("rejects Pending (not a lease status)", () => {
    expect(() => leaseStatusSchema.parse("Pending")).toThrow();
  });
});

describe("tenantAccountStatusSchema", () => {
  it.each(["Active", "ReadOnly"])("accepts %s", (value) => {
    expect(tenantAccountStatusSchema.parse(value)).toBe(value);
  });

  it("rejects Deleted (intentionally absent — portals.md forbids deletion)", () => {
    expect(() => tenantAccountStatusSchema.parse("Deleted")).toThrow();
  });
});
