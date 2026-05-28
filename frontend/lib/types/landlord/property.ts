import { z } from "zod";

export const propertyDtoSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  unitNumber: z.string().nullable(),
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
