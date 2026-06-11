export interface PublicStats {
    rentCollected: number;
    currency: string;
    propertiesManaged: number;
    landlordsOnboarded: number;
}

// Compact, currency-aware headline number (e.g. "€1.5K", "$1.2M"). A fixed
// "en-US" locale keeps server-rendered output deterministic. When no currency
// is known (no confirmed payments yet) we render a plain "0" rather than
// guessing a symbol.
function formatRent(amount: number, currency: string): string {
    if (!currency) return amount.toLocaleString("en-US");
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(amount);
}

export default function StatsStripView({
    rentCollected,
    currency,
    propertiesManaged,
    landlordsOnboarded,
}: PublicStats) {
    const stats = [
        { value: formatRent(rentCollected, currency), label: "Rent collected", testId: "stat-rent" },
        { value: String(propertiesManaged), label: "Properties managed", testId: "stat-properties" },
        { value: String(landlordsOnboarded), label: "Landlords onboarded", testId: "stat-landlords" },
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
