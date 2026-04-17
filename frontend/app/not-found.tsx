import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="text-muted-text text-sm">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="pt-2">
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
