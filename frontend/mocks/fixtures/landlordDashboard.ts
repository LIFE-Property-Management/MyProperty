import { z } from "zod";
import {
    landlordDashboardSchema,
    upcomingPaymentRowSchema,
    type LandlordDashboard,
    type UpcomingPaymentRow,
    type UpcomingPaymentsResponse,
} from "@/lib/types/landlord/dashboard";

const T = (n: string) => `01900000-0000-7000-8000-0000000000${n}`;
const R = (n: string) => `01900000-0000-7000-8000-0000000001${n}`;

export const landlordDashboardFixture: LandlordDashboard = {
    totalProperties: 12,
    activeLeases: 9,
    activeTenants: 9,
    pendingPayments: 3,
    overduePayments: 2,
    generatedAt: "2026-06-03T10:00:00Z",
};


const UPCOMING_NAMES = [
    "Elena Vasic",
    "Marko Petrovic",
    "Ana Jovic",
    "Stefan Novak",
    "Nina Popovic",
    "Luka Ilic",
];
const UPCOMING_TENANT_IDS = [T("04"), T("05"), T("06"), T("07"), T("08"), T("09")];
const UPCOMING_PROPERTIES = ["Some St", "Other Ave", "Third Rd"];
const UPCOMING_AMOUNTS = [380, 450, 500, 620, 290, 410];

export const upcomingPaymentsFixture: UpcomingPaymentRow[] = Array.from(
    { length: 18 },
    (_, i) => ({
        id: R(String(12 + i).padStart(2, "0")),
        tenantId: UPCOMING_TENANT_IDS[i % 6],
        tenantName: UPCOMING_NAMES[i % 6],
        property: `${[10 + i * 3, 20 + i * 2, 5 + i][i % 3]} ${UPCOMING_PROPERTIES[i % 3]}`,
        amount: UPCOMING_AMOUNTS[i % 6],
        currency: "EUR",
        dueDate: `2026-04-${String(5 + i).padStart(2, "0")}`,
    }),
);

export function buildUpcomingPaymentsResponse(
    page: number,
    pageSize: number,
): UpcomingPaymentsResponse {
    const start = (page - 1) * pageSize;
    return {
        items: upcomingPaymentsFixture.slice(start, start + pageSize),
        totalCount: upcomingPaymentsFixture.length,
        page,
        pageSize,
    };
}

landlordDashboardSchema.parse(landlordDashboardFixture);
z.array(upcomingPaymentRowSchema).parse(upcomingPaymentsFixture);
