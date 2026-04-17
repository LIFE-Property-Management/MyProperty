import { leaseSummarySchema } from "../lease";

const BASE = {
  id: "1c7e4f88-2d5a-4f93-bb20-7a6c8e1d4f02",
  propertyId: "a9e5b3d1-6f24-4e8c-9a13-5d7b2c8e0f64",
  propertyName: "Banesa Pejton",
  propertyAddress: "Rruga Fehmi Agani 12, 10000 Prishtinë",
  unitNumber: "3A",
  landlordName: "Albana Krasniqi",
  startDate: "2025-05-01",
  endDate: "2026-04-30",
  monthlyRent: 350,
  currency: "EUR",
  status: "Active" as const,
};

describe("leaseSummarySchema", () => {
  it("accepts a complete active lease", () => {
    expect(() => leaseSummarySchema.parse(BASE)).not.toThrow();
  });

  it("accepts a null unitNumber (property has no units)", () => {
    expect(() => leaseSummarySchema.parse({ ...BASE, unitNumber: null })).not.toThrow();
  });

  it.each(["Active", "Expired", "Terminated"])("accepts status %s", (status) => {
    expect(() => leaseSummarySchema.parse({ ...BASE, status })).not.toThrow();
  });

  it("rejects empty propertyName", () => {
    expect(() => leaseSummarySchema.parse({ ...BASE, propertyName: "" })).toThrow();
  });

  it("rejects empty landlordName", () => {
    expect(() => leaseSummarySchema.parse({ ...BASE, landlordName: "" })).toThrow();
  });

  it("rejects zero monthlyRent", () => {
    expect(() => leaseSummarySchema.parse({ ...BASE, monthlyRent: 0 })).toThrow();
  });

  it("rejects currency that isn't 3 chars", () => {
    expect(() => leaseSummarySchema.parse({ ...BASE, currency: "EU" })).toThrow();
    expect(() => leaseSummarySchema.parse({ ...BASE, currency: "EURO" })).toThrow();
  });

  it("rejects non-UUID id", () => {
    expect(() => leaseSummarySchema.parse({ ...BASE, id: "123" })).toThrow();
  });

  it("rejects non-ISO date (YYYY-MM-DD required)", () => {
    expect(() =>
      leaseSummarySchema.parse({ ...BASE, startDate: "05/01/2025" }),
    ).toThrow();
  });
});
