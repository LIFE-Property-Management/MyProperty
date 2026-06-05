import { z } from "zod";
import {
  landlordTenantRowSchema,
  tenantsResponseSchema,
  type LandlordTenantRow,
  type TenantsResponse,
} from "@/lib/types/landlord/tenant";

const T = (n: string) => `01900000-0000-7000-8000-0000000000${n}`;

export const tenantsFixture: LandlordTenantRow[] = [
  { tenantId: T("01"), email: "john.smith@example.com",   firstName: "John",   lastName: "Smith",    propertyName: "Maple Apartments 12", leaseStatus: "Active",     leaseEndDate: "2026-12-31" },
  { tenantId: T("02"), email: "sara.jones@example.com",   firstName: "Sara",   lastName: "Jones",    propertyName: "Oak Avenue 7B",       leaseStatus: "Active",     leaseEndDate: "2026-09-30" },
  { tenantId: T("03"), email: "mike.ross@example.com",    firstName: "Mike",   lastName: "Ross",     propertyName: "Pine Road 34",        leaseStatus: "Expired",    leaseEndDate: "2025-12-31" },
  { tenantId: T("04"), email: "anna.belle@example.com",   firstName: "Anna",   lastName: "Belle",    propertyName: "Birch House",         leaseStatus: "Active",     leaseEndDate: "2027-03-31" },
  { tenantId: T("05"), email: "chris.ward@example.com",   firstName: "Chris",  lastName: "Ward",     propertyName: "Cedar Blvd Studio",   leaseStatus: "Terminated", leaseEndDate: "2025-06-30" },
  { tenantId: T("06"), email: "david.lee@example.com",    firstName: "David",  lastName: "Lee",      propertyName: "Willow Court 3",      leaseStatus: "Active",     leaseEndDate: "2027-01-31" },
  { tenantId: T("07"), email: "emma.stone@example.com",   firstName: "Emma",   lastName: "Stone",    propertyName: "Elm Square 21",       leaseStatus: "Active",     leaseEndDate: "2026-11-30" },
  { tenantId: T("08"), email: "frank.moore@example.com",  firstName: "Frank",  lastName: "Moore",    propertyName: "Aspen Lofts",         leaseStatus: "Expired",    leaseEndDate: "2025-10-31" },
  { tenantId: T("09"), email: "grace.kim@example.com",    firstName: "Grace",  lastName: "Kim",      propertyName: "Hawthorn Mews",       leaseStatus: "Active",     leaseEndDate: "2027-05-31" },
  { tenantId: T("10"), email: "henry.clark@example.com",  firstName: "Henry",  lastName: "Clark",    propertyName: "Rowan Place",         leaseStatus: "Active",     leaseEndDate: "2026-08-31" },
  { tenantId: T("11"), email: "irene.davis@example.com",  firstName: "Irene",  lastName: "Davis",    propertyName: "Sycamore Bend",       leaseStatus: "Terminated", leaseEndDate: "2025-07-31" },
  { tenantId: T("12"), email: "jack.wilson@example.com",  firstName: "Jack",   lastName: "Wilson",   propertyName: "Beech Grove 8",       leaseStatus: "Active",     leaseEndDate: "2027-02-28" },
  { tenantId: T("13"), email: "karen.hall@example.com",   firstName: "Karen",  lastName: "Hall",     propertyName: "Linden House",        leaseStatus: "Active",     leaseEndDate: "2026-10-31" },
  { tenantId: T("14"), email: "leo.turner@example.com",   firstName: "Leo",    lastName: "Turner",   propertyName: "Magnolia Court",      leaseStatus: "Expired",    leaseEndDate: "2025-09-30" },
  { tenantId: T("15"), email: "mia.adams@example.com",    firstName: "Mia",    lastName: "Adams",    propertyName: "Poplar Heights",      leaseStatus: "Active",     leaseEndDate: "2027-04-30" },
];

z.array(landlordTenantRowSchema).parse(tenantsFixture);

export function buildTenantsResponse(page: number, pageSize: number): TenantsResponse {
  const start = (page - 1) * pageSize;
  const items = tenantsFixture.slice(start, start + pageSize);
  const totalCount = tenantsFixture.length;
  return tenantsResponseSchema.parse({
    items,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  });
}
