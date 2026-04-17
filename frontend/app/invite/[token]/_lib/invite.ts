export interface InvitePreview {
  token: string;
  tenantEmail: string;
  landlordName: string;
  property: {
    address: string;
    unit?: string;
  };
  lease: {
    startDate: string;
    endDate: string;
    monthlyRentEUR: number;
    depositEUR: number;
  };
  expiresAt: string;
}

// Placeholder preview until the backend invite endpoint lands. Keeps the UI
// rendering with realistic data during M2 so downstream steps can be validated.
export function mockInvitePreview(token: string): InvitePreview {
  return {
    token,
    tenantEmail: "tenant@example.com",
    landlordName: "Ada Landlord",
    property: {
      address: "123 Main St, Prishtina",
      unit: "Apt 4B",
    },
    lease: {
      startDate: "2026-05-01",
      endDate: "2027-04-30",
      monthlyRentEUR: 450,
      depositEUR: 900,
    },
    expiresAt: "2026-04-24",
  };
}
