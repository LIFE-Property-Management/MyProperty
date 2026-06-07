import Link from "next/link";

export default function FinalCTA() {
    return (
        <section className="px-6 py-16 md:py-24 bg-primary-light border-t border-border">
            <div className="max-w-2xl mx-auto text-center">
                <h2 className="text-3xl md:text-4xl font-semibold text-primary-text tracking-tight mb-4">
                    Ready to simplify property management?
                </h2>
                <p className="text-muted-text text-lg mb-8">
                    Get started today. No credit card required.
                </p>
                <Link
                    href="/signup"
                    className="inline-flex items-center justify-center px-8 py-4 rounded-lg bg-primary text-white font-medium text-base hover:bg-primary-dark transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-primary-light"
                >
                    Get started — it&apos;s free
                </Link>
            </div>
        </section>
    );
}
