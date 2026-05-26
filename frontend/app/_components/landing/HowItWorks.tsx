const steps = [
    {
        number: "1",
        title: "Add your property",
        description: "Tell us about the unit: address, rent amount, and lease terms.",
    },
    {
        number: "2",
        title: "Invite your tenant by email",
        description:
            "We'll send them a secure invite link. They accept the lease, then set up their account.",
    },
    {
        number: "3",
        title: "Track rent automatically",
        description:
            "Tenants pay; you confirm. Receipts, history, and reminders — all handled for you.",
    },
];

export default function HowItWorks() {
    return (
        <section className="px-6 py-16 md:py-24 bg-surface border-t border-border">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-semibold text-primary-text tracking-tight mb-4">
                        Get started in minutes
                    </h2>
                    <p className="text-muted-text text-lg max-w-md mx-auto">
                        No setup fees. No training required. Just log in and go.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    {steps.map(({ number, title, description }) => (
                        <div key={number} className="flex flex-col items-center text-center md:items-start md:text-left">
                            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center mb-4 flex-shrink-0">
                                <span className="font-heading text-primary font-semibold text-base">
                                    {number}
                                </span>
                            </div>
                            <h3 className="font-semibold text-primary-text mb-2">{title}</h3>
                            <p className="text-sm text-muted-text leading-relaxed">{description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
