import { z } from "zod";

export const propertyTypeSchema = z.enum(["House", "Apartment", "Commercial", "Other"]);
export type PropertyType = z.infer<typeof propertyTypeSchema>;

export const propertyTenantSchema = z.object({
  tenantId: z.uuid(),
  fullName: z.string(),
  email: z.email(),
  leaseStart: z.iso.date(),
  leaseEnd: z.iso.date(),
  monthlyRent: z.number(),
  currency: z.string().length(3),
  leaseStatus: z.string(),
});

export const propertyDetailSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  unitNumber: z.string().nullable(),
  propertyType: propertyTypeSchema,
  createdAt: z.iso.datetime(),
  tenants: z.array(propertyTenantSchema),
});

export type PropertyTenant = z.infer<typeof propertyTenantSchema>;
export type PropertyDetail = z.infer<typeof propertyDetailSchema>;

export const propertyDtoSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  unitNumber: z.string().nullable(),
  propertyType: propertyTypeSchema,
  createdAt: z.iso.datetime(),
});

export const propertiesResponseSchema = z.object({
  items: z.array(propertyDtoSchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export type PropertyDto = z.infer<typeof propertyDtoSchema>;
export type PropertiesResponse = z.infer<typeof propertiesResponseSchema>;
