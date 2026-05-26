// TODO(landing): wire to /api/v1/stats/public once that endpoint exists.
// See backend M4+ planning. Until then, placeholder zeros are used deliberately
// — do not substitute fake inflated numbers before real data is available.

const stats = [
    { value: "$0", label: "Rent collected", testId: "stat-rent" },
    { value: "0", label: "Properties managed", testId: "stat-properties" },
    { value: "0", label: "Landlords onboarded", testId: "stat-landlords" },
];

export default function StatsStrip() {
    return (
        <section className="px-6 py-14 md:py-20 bg-background border-t border-border">
            <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    {stats.map(({ value, label, testId }) => (
                        <div key={label}>
                            <p
                                className="font-heading text-4xl md:text-5xl text-primary font-semibold mb-2"
                                data-todo="real-stats"
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
