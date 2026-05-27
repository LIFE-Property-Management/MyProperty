import { z } from "zod";
import {
    propertyRowSchema,
    propertiesResponseSchema,
    type PropertyRow,
    type PropertiesResponse,
} from "@/lib/types/landlord/property";

const P = (n: string) => `02900000-0000-7000-8000-0000000000${n}`;

export const propertiesFixture: PropertyRow[] = [
    { id: P("01"), name: "Maple Apartments 12", address: "Maple Street 12", unitNumber: "A", createdAt: "2025-01-10T09:00:00Z" },
    { id: P("02"), name: "Oak Avenue 7B", address: "Oak Avenue 7", unitNumber: "B", createdAt: "2025-02-14T11:30:00Z" },
    { id: P("03"), name: "Pine Road 34", address: "Pine Road 34", unitNumber: null, createdAt: "2025-03-01T08:00:00Z" },
    { id: P("04"), name: "Birch House", address: "Birch Street 18", unitNumber: null, createdAt: "2025-04-05T14:00:00Z" },
    { id: P("05"), name: "Cedar Blvd Studio", address: "Cedar Boulevard 5", unitNumber: "2C", createdAt: "2025-05-20T10:00:00Z" },
];

z.array(propertyRowSchema).parse(propertiesFixture);

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
