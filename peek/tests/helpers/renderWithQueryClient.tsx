import React from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Creates a fresh QueryClient configured for tests (no retries).
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/**
 * Renders a React element wrapped in a QueryClientProvider with a per-test
 * QueryClient.  Uses Testing Library's native `wrapper` option so that
 * `rerender()` reuses the same provider instance instead of remounting.
 *
 * Usage:
 * ```ts
 * const { rerender } = renderWithQueryClient(<MyComponent />);
 * ```
 */
export function renderWithQueryClient(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
