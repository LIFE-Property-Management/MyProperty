"use client";

import { useEffect, useState, type ReactNode } from "react";

interface MockProviderProps {
  children: ReactNode;
}

export function MockProvider({ children }: MockProviderProps) {
  const [ready, setReady] = useState<boolean>(
    process.env.NODE_ENV !== "development"
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    let cancelled = false;

    const start = async (): Promise<void> => {
      const { worker } = await import("./browser");
      await worker.start({
        onUnhandledRequest: "bypass",
      });
      if (!cancelled) setReady(true);
    };

    void start();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
