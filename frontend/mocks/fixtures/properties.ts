import { z } from "zod";
import {
  propertyDtoSchema,
  propertiesResponseSchema,
  type PropertyDto,
  type PropertiesResponse,
} from "@/lib/types/landlord/property";

const P = (n: string) => `02900000-0000-7000-8000-0000000000${n}`;

export const propertiesFixture: PropertyDto[] = [
  { id: P("01"), name: "Maple Apartments 12", address: "Maple Street 12",    unitNumber: "A",  propertyType: "Apartment", createdAt: "2025-01-10T09:00:00Z" },
  { id: P("02"), name: "Oak Avenue 7B",        address: "Oak Avenue 7",      unitNumber: "B",  propertyType: "Apartment", createdAt: "2025-02-14T11:30:00Z" },
  { id: P("03"), name: "Pine Road 34",         address: "Pine Road 34",      unitNumber: null, propertyType: "House",     createdAt: "2025-03-01T08:00:00Z" },
  { id: P("04"), name: "Birch House",          address: "Birch Street 18",   unitNumber: null, propertyType: "House",     createdAt: "2025-04-05T14:00:00Z" },
  { id: P("05"), name: "Cedar Blvd Studio",    address: "Cedar Boulevard 5", unitNumber: "2C", propertyType: "Apartment", createdAt: "2025-05-20T10:00:00Z" },
  { id: P("06"), name: "Willow Court 3",       address: "Willow Court 3",    unitNumber: "1",  propertyType: "Apartment", createdAt: "2025-06-02T09:15:00Z" },
  { id: P("07"), name: "Elm Square 21",        address: "Elm Square 21",     unitNumber: null, propertyType: "Commercial",createdAt: "2025-06-18T13:45:00Z" },
  { id: P("08"), name: "Aspen Lofts",          address: "Aspen Lane 9",      unitNumber: "3B", propertyType: "Apartment", createdAt: "2025-07-04T10:30:00Z" },
  { id: P("09"), name: "Hawthorn Mews",        address: "Hawthorn Way 14",   unitNumber: null, propertyType: "House",     createdAt: "2025-07-22T08:50:00Z" },
  { id: P("10"), name: "Rowan Place",          address: "Rowan Place 6",     unitNumber: "C",  propertyType: "Apartment", createdAt: "2025-08-10T11:00:00Z" },
  { id: P("11"), name: "Sycamore Bend",        address: "Sycamore Bend 2",   unitNumber: null, propertyType: "House",     createdAt: "2025-08-28T15:20:00Z" },
  { id: P("12"), name: "Beech Grove 8",        address: "Beech Grove 8",     unitNumber: "4A", propertyType: "Apartment", createdAt: "2025-09-15T09:40:00Z" },
  { id: P("13"), name: "Linden House",         address: "Linden Lane 11",    unitNumber: null, propertyType: "House",     createdAt: "2025-10-01T12:00:00Z" },
  { id: P("14"), name: "Magnolia Court",       address: "Magnolia Ct 3",     unitNumber: "B2", propertyType: "Commercial",createdAt: "2025-10-19T14:10:00Z" },
  { id: P("15"), name: "Poplar Heights",       address: "Poplar Rd 27",      unitNumber: null, propertyType: "House",     createdAt: "2025-11-05T10:25:00Z" },
];

z.array(propertyDtoSchema).parse(propertiesFixture);

export function buildPropertiesResponse(page: number, pageSize: number): PropertiesResponse {
  const start = (page - 1) * pageSize;
  const items = propertiesFixture.slice(start, start + pageSize);
  const totalCount = propertiesFixture.length;
  return propertiesResponseSchema.parse({
    items,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  });
}
