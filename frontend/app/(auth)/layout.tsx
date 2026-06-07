import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
            <div className="mb-8">
                <Link href="/" aria-label="MyProperty home">
                    <Logo />
                </Link>
            </div>

            {children}

            <Link
                href="/"
                className="mt-6 text-sm text-muted-text hover:text-primary-text transition-colors duration-150"
            >
                ← Back to home
            </Link>
        </div>
    );
}
