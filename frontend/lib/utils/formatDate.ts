// Uses UTC timezone to prevent the displayed date from shifting by 1 day
// due to local timezone offset when parsing a date-only ISO string.
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}
