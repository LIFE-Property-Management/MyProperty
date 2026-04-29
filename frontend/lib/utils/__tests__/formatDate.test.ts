import { formatDate } from "../formatDate";

describe("formatDate", () => {
  it('formats "2026-04-20" as "Apr 20, 2026"', () => {
    expect(formatDate("2026-04-20")).toBe("Apr 20, 2026");
  });

  it('formats "2026-01-01" as "Jan 1, 2026"', () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
  });

  it('formats "2026-12-31" as "Dec 31, 2026"', () => {
    expect(formatDate("2026-12-31")).toBe("Dec 31, 2026");
  });
});
