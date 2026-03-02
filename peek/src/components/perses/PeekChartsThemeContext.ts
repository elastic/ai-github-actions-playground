import { createContext } from "react";
import type { PersesChartsTheme } from "@perses-dev/components";

/**
 * Local React context that mirrors the Perses {@link ChartsThemeContext}.
 *
 * This exists so that `useEChartTheme` can read the centrally-managed Perses
 * charts theme **without** importing `@perses-dev/components` directly — that
 * import triggers CSS font loading which breaks in Node test environments.
 *
 * Populated by {@link PersesProviders}.
 */
export const PeekChartsThemeContext = createContext<PersesChartsTheme | undefined>(undefined);
