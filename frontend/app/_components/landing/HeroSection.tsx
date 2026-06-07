import Link from "next/link";

const FEATURE_PILLS = ["Lease management", "Rent tracking", "Tenant portal", "Payment reminders"];

export default function HeroSection() {
    return (
        <section className="flex items-center justify-center px-6 py-20 md:py-28">
            <div className="max-w-2xl w-full text-center">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 bg-primary-light border border-primary/20 rounded-full px-4 py-1.5 mb-8">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span className="text-sm text-primary font-medium">
                        Property management, simplified
                    </span>
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-primary-text leading-tight tracking-tight mb-6">
                    Manage your properties
                    <br />
                    <span className="text-primary">from anywhere.</span>
                </h1>

                <p className="text-lg text-muted-text leading-relaxed max-w-xl mx-auto mb-10 font-light">
                    Track leases, collect rent, and stay on top of your portfolio — no matter where
                    you are in the world.
                </p>

                <div className="flex gap-3 justify-center flex-wrap">
                    <Link
                        href="/signup"
                        className="inline-flex items-center justify-center px-8 py-3.5 rounded-lg bg-primary text-white font-medium text-base hover:bg-primary-dark transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                        Get started — it&apos;s free
                    </Link>
                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center px-8 py-3.5 rounded-lg bg-surface text-primary-text font-medium text-base border border-border hover:bg-neutral-light transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                        Log in
                    </Link>
                </div>

                {/* Feature pills */}
                <div className="flex gap-2.5 justify-center flex-wrap mt-12">
                    {FEATURE_PILLS.map((label) => (
                        <span
                            key={label}
                            className="text-sm text-muted-text bg-surface border border-border rounded-full px-3.5 py-1"
                        >
                            {label}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}
