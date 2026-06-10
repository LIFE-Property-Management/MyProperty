"use client";

import { usePublicStats } from "@/lib/hooks";

function formatRent(amount: number): string {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
    return `$${amount.toLocaleString()}`;
}

export default function StatsStrip() {
    const { data } = usePublicStats();

    const stats = [
        {
            value: formatRent(data?.rentCollected ?? 0),
            label: "Rent collected",
            testId: "stat-rent",
        },
        {
            value: String(data?.propertiesManaged ?? 0),
            label: "Properties managed",
            testId: "stat-properties",
        },
        {
            value: String(data?.landlordsOnboarded ?? 0),
            label: "Landlords onboarded",
            testId: "stat-landlords",
        },
    ];

    return (
        <section className="px-6 py-14 md:py-20 bg-background border-t border-border">
            <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    {stats.map(({ value, label, testId }) => (
                        <div key={label}>
                            <p
                                className="font-heading text-4xl md:text-5xl text-primary font-semibold mb-2"
                                data-testid={testId}
                            >
                                {value}
                            </p>
                            <p className="text-sm text-muted-text">{label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
