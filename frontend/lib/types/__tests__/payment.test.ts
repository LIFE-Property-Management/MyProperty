import {
  paymentSchema,
  receiptUploadFormSchema,
  manualRequestFormSchema,
  paymentHistoryEntrySchema,
  paymentHistoryResponseSchema,
} from "../payment";

const VALID_UUID = "d6e2f9b4-3c7a-4f1e-8a92-1b5c8d4e7f30";
const OTHER_UUID = "1c7e4f88-2d5a-4f93-bb20-7a6c8e1d4f02";

function makeFile(
  name: string,
  type: string,
  sizeBytes: number,
): File {
  const bytes = new Uint8Array(sizeBytes);
  return new File([bytes], name, { type });
}

describe("paymentSchema", () => {
  const base = {
    id: VALID_UUID,
    leaseId: OTHER_UUID,
    amount: 350,
    currency: "EUR",
    dueDate: "2026-04-30",
    status: "Outstanding" as const,
    method: null,
    submittedAt: null,
    confirmedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    receiptFileName: null,
    receiptFileUrl: null,
    notes: null,
  };

  it("accepts a valid Outstanding payment with all nullable fields null", () => {
    expect(() => paymentSchema.parse(base)).not.toThrow();
  });

  it("accepts a Pending payment with method + submittedAt", () => {
    const value = {
      ...base,
      status: "Pending" as const,
      method: "ReceiptUpload" as const,
      submittedAt: "2026-04-02T10:15:00Z",
      receiptFileName: "receipt.pdf",
      receiptFileUrl: "https://example.com/r.pdf",
    };
    expect(() => paymentSchema.parse(value)).not.toThrow();
  });

  it("rejects negative amount", () => {
    expect(() => paymentSchema.parse({ ...base, amount: -1 })).toThrow();
  });

  it("rejects zero amount", () => {
    expect(() => paymentSchema.parse({ ...base, amount: 0 })).toThrow();
  });

  it("rejects wrong-length currency code (ISO 4217 is 3 chars)", () => {
    expect(() => paymentSchema.parse({ ...base, currency: "EURO" })).toThrow();
  });

  it("rejects malformed dueDate (must be YYYY-MM-DD)", () => {
    expect(() => paymentSchema.parse({ ...base, dueDate: "30/04/2026" })).toThrow();
  });

  it("rejects non-UUID id", () => {
    expect(() => paymentSchema.parse({ ...base, id: "not-a-uuid" })).toThrow();
  });

  it("rejects unknown status", () => {
    expect(() => paymentSchema.parse({ ...base, status: "Late" })).toThrow();
  });

  it("rejects non-URL receipt url", () => {
    expect(() =>
      paymentSchema.parse({ ...base, receiptFileUrl: "not-a-url" }),
    ).toThrow();
  });
});

describe("receiptUploadFormSchema", () => {
  const baseValues = {
    paymentId: VALID_UUID,
    notes: "",
  };

  it("accepts a valid JPEG under 5MB", () => {
    const result = receiptUploadFormSchema.safeParse({
      ...baseValues,
      receipt: makeFile("r.jpg", "image/jpeg", 1024 * 1024),
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid PNG", () => {
    const result = receiptUploadFormSchema.safeParse({
      ...baseValues,
      receipt: makeFile("r.png", "image/png", 1024),
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid PDF", () => {
    const result = receiptUploadFormSchema.safeParse({
      ...baseValues,
      receipt: makeFile("r.pdf", "application/pdf", 1024),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a file over 5MB", () => {
    const result = receiptUploadFormSchema.safeParse({
      ...baseValues,
      receipt: makeFile("r.pdf", "application/pdf", 5 * 1024 * 1024 + 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(" ");
      expect(msg).toContain("5MB");
    }
  });

  it("rejects unsupported MIME types (GIF)", () => {
    const result = receiptUploadFormSchema.safeParse({
      ...baseValues,
      receipt: makeFile("r.gif", "image/gif", 1024),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(" ");
      expect(msg).toMatch(/JPEG|PNG|PDF/);
    }
  });

  it("rejects missing receipt", () => {
    const result = receiptUploadFormSchema.safeParse({
      ...baseValues,
      receipt: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects notes over 500 chars", () => {
    const result = receiptUploadFormSchema.safeParse({
      paymentId: VALID_UUID,
      notes: "x".repeat(501),
      receipt: makeFile("r.pdf", "application/pdf", 1024),
    });
    expect(result.success).toBe(false);
  });

  it("accepts notes exactly at 500 chars", () => {
    const result = receiptUploadFormSchema.safeParse({
      paymentId: VALID_UUID,
      notes: "x".repeat(500),
      receipt: makeFile("r.pdf", "application/pdf", 1024),
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID paymentId", () => {
    const result = receiptUploadFormSchema.safeParse({
      paymentId: "not-a-uuid",
      notes: "",
      receipt: makeFile("r.pdf", "application/pdf", 1024),
    });
    expect(result.success).toBe(false);
  });
});

describe("manualRequestFormSchema", () => {
  it("accepts valid notes", () => {
    const result = manualRequestFormSchema.safeParse({
      paymentId: VALID_UUID,
      notes: "Paid 100 EUR in cash on Monday morning.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty notes (required for cash payment description)", () => {
    const result = manualRequestFormSchema.safeParse({
      paymentId: VALID_UUID,
      notes: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(" ");
      expect(msg).toMatch(/describe|required|empty|small/i);
    }
  });

  it("rejects notes over 500 chars", () => {
    const result = manualRequestFormSchema.safeParse({
      paymentId: VALID_UUID,
      notes: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("paymentHistoryEntrySchema", () => {
  it("accepts a valid Confirmed entry", () => {
    const result = paymentHistoryEntrySchema.safeParse({
      id: VALID_UUID,
      amount: 350,
      currency: "EUR",
      dueDate: "2026-02-28",
      status: "Confirmed",
      method: "ReceiptUpload",
      submittedAt: "2026-02-26T14:30:00Z",
      confirmedAt: "2026-02-27T09:12:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts Outstanding with null method/submittedAt/confirmedAt", () => {
    const result = paymentHistoryEntrySchema.safeParse({
      id: VALID_UUID,
      amount: 350,
      currency: "EUR",
      dueDate: "2026-05-31",
      status: "Outstanding",
      method: null,
      submittedAt: null,
      confirmedAt: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("paymentHistoryResponseSchema", () => {
  const validEntry = {
    id: VALID_UUID,
    amount: 350,
    currency: "EUR",
    dueDate: "2026-02-28",
    status: "Confirmed" as const,
    method: "ReceiptUpload" as const,
    submittedAt: "2026-02-26T14:30:00Z",
    confirmedAt: "2026-02-27T09:12:00Z",
  };

  it("accepts a valid paginated response", () => {
    const result = paymentHistoryResponseSchema.safeParse({
      items: [validEntry],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty items array with totalCount 0", () => {
    const result = paymentHistoryResponseSchema.safeParse({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects page 0 (history is 1-indexed)", () => {
    const result = paymentHistoryResponseSchema.safeParse({
      items: [],
      totalCount: 0,
      page: 0,
      pageSize: 10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative totalCount", () => {
    const result = paymentHistoryResponseSchema.safeParse({
      items: [],
      totalCount: -1,
      page: 1,
      pageSize: 10,
    });
    expect(result.success).toBe(false);
  });
});
