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
      try {
        const { worker } = await import("./browser");
        await worker.start({ onUnhandledRequest: "bypass" });
      } catch (error) {
        // Service worker registration can fail under some harness conditions
        // (e.g. Playwright with unusual flags). Rendering must not stall —
        // fall through and let requests hit the real transport or a
        // test-framework intercept (e.g. page.route).
        console.warn("[mocks] MSW worker failed to start; continuing without mocks", error);
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void start();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
