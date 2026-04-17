"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted-text text-sm">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-text font-mono">
            Ref: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <Button onClick={reset}>Try again</Button>
          <Button
            variant="secondary"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
