import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const navLinkBase =
    "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-150 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-background h-10 px-4 text-sm";

export default function LandingNav() {
    return (
        <nav className="border-b border-border bg-surface">
            <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                <Link href="/" aria-label="MyProperty home">
                    <Logo />
                </Link>

                <div className="flex items-center gap-3">
                    <Link
                        href="/login"
                        className={`${navLinkBase} bg-surface text-primary-text border border-border hover:bg-neutral-light`}
                    >
                        Log in
                    </Link>
                    <Link
                        href="/signup"
                        className={`${navLinkBase} bg-primary text-white hover:bg-primary-dark`}
                    >
                        Sign up
                    </Link>
                </div>
            </div>
        </nav>
    );
}
