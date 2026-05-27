import { z } from "zod";

export const propertyRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  unitNumber: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const propertiesResponseSchema = z.object({
  items: z.array(propertyRowSchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export type PropertyRow = z.infer<typeof propertyRowSchema>;
export type PropertiesResponse = z.infer<typeof propertiesResponseSchema>;
