import { Card } from "@/components/ui/Card";

const features = [
    {
        title: "Lease management",
        description:
            "Track lease start/end dates, terms, and renewals from one dashboard. Never miss a renewal again.",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <polyline
                    points="14 2 14 8 20 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <line
                    x1="16"
                    y1="13"
                    x2="8"
                    y2="13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                <line
                    x1="16"
                    y1="17"
                    x2="8"
                    y2="17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                <polyline
                    points="10 9 9 9 8 9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
            </svg>
        ),
    },
    {
        title: "Automated rent collection",
        description:
            "Tenants pay online; you get notified the moment money arrives. Overdue reminders sent automatically.",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path
                    d="M12 6v6l4 2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M12 8v1m0 6v1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                <path
                    d="M9.5 10.5C9.5 9.1 10.6 8 12 8s2.5 1.1 2.5 2.5c0 1.9-2.5 3.5-2.5 3.5s-2.5-1.6-2.5-3.5z"
                    fill="currentColor"
                    opacity="0.3"
                />
            </svg>
        ),
    },
    {
        title: "Tenant portal",
        description:
            "Tenants see their payment history, lease details, and can reach you — no more lost emails or missed calls.",
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                    d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle
                    cx="9"
                    cy="7"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M23 21v-2a4 4 0 0 0-3-3.87"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M16 3.13a4 4 0 0 1 0 7.75"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        ),
    },
];

export default function FeaturesGrid() {
    return (
        <section className="px-6 py-16 md:py-24 bg-background">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-semibold text-primary-text tracking-tight mb-4">
                        Everything you need to manage your properties
                    </h2>
                    <p className="text-muted-text text-lg max-w-xl mx-auto">
                        Built for independent landlords. No bloat, no complexity.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map(({ title, description, icon }) => (
                        <Card key={title} padding="lg" as="article">
                            <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center text-primary mb-4">
                                {icon}
                            </div>
                            <h3 className="font-semibold text-primary-text mb-2">{title}</h3>
                            <p className="text-sm text-muted-text leading-relaxed">{description}</p>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
