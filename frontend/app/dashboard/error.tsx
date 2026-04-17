"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function DashboardError({
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
        <h1 className="text-2xl font-semibold">Dashboard failed to load</h1>
        <p className="text-muted-text text-sm">
          We could not load your dashboard right now.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-text font-mono">
            Ref: {error.digest}
          </p>
        )}
        <div className="pt-2">
          <Button onClick={reset}>Retry</Button>
        </div>
      </div>
    </div>
  );
}
