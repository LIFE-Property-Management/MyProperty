import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  // Optional plain-language sub-line under the value (e.g. "of 64 properties").
  hint?: string;
}

// A single headline KPI tile. Mirrors the landlord dashboard card styling so
// the two portals feel consistent.
export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <p className="text-sm text-muted-text mb-2">{label}</p>
      <p className="text-4xl font-semibold text-primary-text">{value}</p>
      {hint && <p className="text-sm text-muted-text mt-2">{hint}</p>}
    </div>
  );
}

export default KpiCard;
