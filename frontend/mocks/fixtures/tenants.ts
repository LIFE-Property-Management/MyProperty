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
