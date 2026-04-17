// Render helper that wraps children in a fresh QueryClientProvider per test.
// A per-test QueryClient avoids cache bleed between tests — retries disabled,
// gcTime 0 so mutations don't linger, and no background refetches.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
        refetchOnMount: true,
      },
      mutations: { retry: false },
    },
  });
}

interface WrapperOptions {
  client?: QueryClient;
}

export function renderWithQuery(
  ui: ReactElement,
  options: WrapperOptions & Omit<RenderOptions, "wrapper"> = {},
): RenderResult & { client: QueryClient } {
  const client = options.client ?? makeQueryClient();
  const { client: _ignored, ...rtlOptions } = options;
  void _ignored;

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  const result = render(ui, { wrapper: Wrapper, ...rtlOptions });
  return { ...result, client };
}
