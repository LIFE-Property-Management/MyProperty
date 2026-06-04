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
  { tenantId: T("06"), email: "emma.stone@example.com",   firstName: "Emma",   lastName: "Stone",    propertyName: "Elm Court 3A",        leaseStatus: "Active",     leaseEndDate: "2026-11-30" },
  { tenantId: T("07"), email: "liam.gray@example.com",    firstName: "Liam",   lastName: "Gray",     propertyName: "Willow Lane 9",       leaseStatus: "Active",     leaseEndDate: "2027-01-31" },
  { tenantId: T("08"), email: "noah.king@example.com",    firstName: "Noah",   lastName: "King",     propertyName: "Aspen Heights 14",    leaseStatus: "Expired",    leaseEndDate: "2025-10-31" },
  { tenantId: T("09"), email: "olivia.fox@example.com",   firstName: "Olivia", lastName: "Fox",      propertyName: "Spruce Court 2",      leaseStatus: "Active",     leaseEndDate: "2026-08-31" },
  { tenantId: T("10"), email: "ava.reed@example.com",     firstName: "Ava",    lastName: "Reed",     propertyName: "Magnolia Flats 5",    leaseStatus: "Terminated", leaseEndDate: "2025-04-30" },
  { tenantId: T("11"), email: "ethan.hall@example.com",   firstName: "Ethan",  lastName: "Hall",     propertyName: "Juniper Place 8",     leaseStatus: "Active",     leaseEndDate: "2027-02-28" },
  { tenantId: T("12"), email: "mia.young@example.com",    firstName: "Mia",    lastName: "Young",    propertyName: "Hawthorn Row 1",      leaseStatus: "Active",     leaseEndDate: "2026-12-15" },
  { tenantId: T("13"), email: "lucas.bell@example.com",   firstName: "Lucas",  lastName: "Bell",     propertyName: "Sycamore Tower 21",   leaseStatus: "Expired",    leaseEndDate: "2025-09-30" },
  { tenantId: T("14"), email: "amelia.ray@example.com",   firstName: "Amelia", lastName: "Ray",      propertyName: "Poplar Mews 6",       leaseStatus: "Active",     leaseEndDate: "2026-07-31" },
  { tenantId: T("15"), email: "james.cole@example.com",   firstName: "James",  lastName: "Cole",     propertyName: "Linden Gardens 4",    leaseStatus: "Active",     leaseEndDate: "2027-05-31" },
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
