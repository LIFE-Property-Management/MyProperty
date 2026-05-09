import { z } from "zod";
import {
  landlordDashboardSchema,
  upcomingPaymentRowSchema,
  type LandlordDashboard,
  type UpcomingPaymentRow,
  type UpcomingPaymentsResponse,
} from "@/lib/types/landlord/dashboard";

// Tenant UUIDs: ...0000000000XX (XX = 01–09)
const T = (n: string) => `01900000-0000-7000-8000-0000000000${n}`;

// Row UUIDs: ...0000000001XX (XX = 0101–0129)
const R = (n: string) => `01900000-0000-7000-8000-0000000001${n}`;

export const landlordDashboardFixture: LandlordDashboard = {
  stats: {
    totalProperties: 12,
    totalActiveTenants: 9,
  },
  overduePayments: [
    {
      id: R("01"),
      tenantId: T("01"),
      tenantName: "John Smith",
      property: "123 Main St",
      amount: 400,
      currency: "EUR",
      daysOverdue: 12,
    },
    {
      id: R("02"),
      tenantId: T("02"),
      tenantName: "Sara Jones",
      property: "456 Oak Ave",
      amount: 550,
      currency: "EUR",
      daysOverdue: 5,
    },
    {
      id: R("03"),
      tenantId: T("03"),
      tenantName: "Mike Ross",
      property: "789 Elm St",
      amount: 320,
      currency: "EUR",
      daysOverdue: 3,
    },
  ],
  expiringLeases: [
    {
      id: R("04"),
      tenantId: T("04"),
      tenantName: "Anna Belle",
      property: "22 Rose Ln",
      leaseEndDate: "2026-04-20",
      daysRemaining: 14,
    },
    {
      id: R("05"),
      tenantId: T("05"),
      tenantName: "Chris Ward",
      property: "88 Pine Rd",
      leaseEndDate: "2026-04-28",
      daysRemaining: 22,
    },
    {
      id: R("06"),
      tenantId: T("06"),
      tenantName: "Lena Müller",
      property: "5 Cedar Blvd",
      leaseEndDate: "2026-05-01",
      daysRemaining: 25,
    },
  ],
  recentPayments: [
    {
      id: R("07"),
      tenantId: T("07"),
      tenantName: "Tom Baker",
      property: "14 Birch St",
      amount: 480,
      currency: "EUR",
      method: "ReceiptUpload",
      datePaid: "2026-04-01",
    },
    {
      id: R("08"),
      tenantId: T("08"),
      tenantName: "Mia Fox",
      property: "33 Maple Ave",
      amount: 600,
      currency: "EUR",
      method: "ManualRequest",
      datePaid: "2026-03-31",
    },
    {
      id: R("09"),
      tenantId: T("09"),
      tenantName: "Jay Park",
      property: "7 Willow Way",
      amount: 350,
      currency: "EUR",
      method: "ReceiptUpload",
      datePaid: "2026-03-30",
    },
    {
      id: R("10"),
      tenantId: T("01"),
      tenantName: "Nora Quinn",
      property: "61 Spruce Ct",
      amount: 420,
      currency: "EUR",
      method: "ManualRequest",
      datePaid: "2026-03-29",
    },
    {
      id: R("11"),
      tenantId: T("02"),
      tenantName: "Sam Lee",
      property: "9 Aspen Dr",
      amount: 510,
      currency: "EUR",
      method: "ReceiptUpload",
      datePaid: "2026-03-28",
    },
  ],
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
