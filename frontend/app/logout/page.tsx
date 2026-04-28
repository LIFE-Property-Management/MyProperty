import Link from "next/link";

export default function LogoutPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold text-primary-text">You&apos;ve been signed out.</h1>
        <p className="text-muted-text">Your session has ended.</p>
        <Link
          href="/"
          className="inline-block mt-2 text-primary hover:text-primary-dark underline underline-offset-4"
        >
          Return to home
        </Link>
      </div>
    </div>
  );
}
