import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="text-muted-text text-sm">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center h-10 px-4 text-sm md:text-base font-medium rounded-md bg-primary text-white hover:bg-primary-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
