import { tenantDetailSchema, type TenantDetail } from "@/lib/types/landlord/tenant";

const T = (n: string) => `01900000-0000-7000-8000-0000000000${n}`;
const L = (n: string) => `03900000-0000-7000-8000-0000000000${n}`;
const P = (n: string) => `04900000-0000-7000-8000-0000000000${n}`;

const makeDetail = (
  tenantId: string,
  email: string,
  fullName: string,
  propertyName: string,
  leaseId: string,
  leaseStatus: "Active" | "Expired" | "Terminated",
  monthlyRent: number,
): TenantDetail =>
  tenantDetailSchema.parse({
    tenantId,
    email,
    fullName,
    propertyName,
    leaseId,
    leaseStartDate: "2025-01-01",
    leaseEndDate: leaseStatus === "Active" ? "2026-12-31" : "2025-12-31",
    monthlyRent,
    currency: "EUR",
    leaseStatus,
    paymentHistory: [
      { id: P("01"), amount: monthlyRent, currency: "EUR", dueDate: "2026-04-01", status: "Confirmed",   submittedAt: "2026-04-02T10:00:00Z", confirmedAt: "2026-04-03T09:00:00Z", rejectedAt: null },
      { id: P("02"), amount: monthlyRent, currency: "EUR", dueDate: "2026-03-01", status: "Confirmed",   submittedAt: "2026-03-02T11:00:00Z", confirmedAt: "2026-03-03T08:00:00Z", rejectedAt: null },
      { id: P("03"), amount: monthlyRent, currency: "EUR", dueDate: "2026-05-01", status: "Pending",     submittedAt: "2026-05-02T14:00:00Z", confirmedAt: null,                   rejectedAt: null },
      { id: P("04"), amount: monthlyRent, currency: "EUR", dueDate: "2026-02-01", status: "Rejected",    submittedAt: "2026-02-03T09:00:00Z", confirmedAt: null,                   rejectedAt: "2026-02-04T10:00:00Z" },
      { id: P("05"), amount: monthlyRent, currency: "EUR", dueDate: "2026-06-01", status: "Outstanding", submittedAt: null,                   confirmedAt: null,                   rejectedAt: null },
    ],
  });

export const tenantDetailFixtures: Record<string, TenantDetail> = {
  [T("01")]: makeDetail(T("01"), "john.smith@example.com",  "John Smith",  "Maple Apartments 12", L("01"), "Active",     1200),
  [T("02")]: makeDetail(T("02"), "sara.jones@example.com",  "Sara Jones",  "Oak Avenue 7B",       L("02"), "Active",     950),
  [T("03")]: makeDetail(T("03"), "mike.ross@example.com",   "Mike Ross",   "Pine Road 34",        L("03"), "Expired",    800),
  [T("04")]: makeDetail(T("04"), "anna.belle@example.com",  "Anna Belle",  "Birch House",         L("04"), "Active",     1500),
  [T("05")]: makeDetail(T("05"), "chris.ward@example.com",  "Chris Ward",  "Cedar Blvd Studio",   L("05"), "Terminated", 700),
  [T("06")]: makeDetail(T("06"), "david.lee@example.com",   "David Lee",   "Willow Court 3",      L("06"), "Active",     1100),
  [T("07")]: makeDetail(T("07"), "emma.stone@example.com",  "Emma Stone",  "Elm Square 21",       L("07"), "Active",     1800),
  [T("08")]: makeDetail(T("08"), "frank.moore@example.com", "Frank Moore", "Aspen Lofts",         L("08"), "Expired",    1350),
  [T("09")]: makeDetail(T("09"), "grace.kim@example.com",   "Grace Kim",   "Hawthorn Mews",       L("09"), "Active",     1600),
  [T("10")]: makeDetail(T("10"), "henry.clark@example.com", "Henry Clark", "Rowan Place",         L("10"), "Active",     1250),
  [T("11")]: makeDetail(T("11"), "irene.davis@example.com", "Irene Davis", "Sycamore Bend",       L("11"), "Terminated", 900),
  [T("12")]: makeDetail(T("12"), "jack.wilson@example.com", "Jack Wilson", "Beech Grove 8",       L("12"), "Active",     1400),
  [T("13")]: makeDetail(T("13"), "karen.hall@example.com",  "Karen Hall",  "Linden House",        L("13"), "Active",     1550),
  [T("14")]: makeDetail(T("14"), "leo.turner@example.com",  "Leo Turner",  "Magnolia Court",      L("14"), "Expired",    2000),
  [T("15")]: makeDetail(T("15"), "mia.adams@example.com",   "Mia Adams",   "Poplar Heights",      L("15"), "Active",     1300),
};
