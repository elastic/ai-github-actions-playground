import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type { PageContextSections } from "../services/screenContext";

interface PageContextState extends PageContextSections {
  setPageSection: <K extends keyof PageContextSections>(
    key: K,
    value: PageContextSections[K],
  ) => void;
  resetPageContext: () => void;
}

const EMPTY: PageContextSections = {
  clusterOverview: undefined,
  clusterHealth: undefined,
  indices: undefined,
  dataStreams: undefined,
  ingestPipelines: undefined,
  fleet: undefined,
  fleetAgent: undefined,
  security: undefined,
  console: undefined,
};

export const usePageContextStore = create<PageContextState>()(
  devtools(
    (set) => ({
      ...EMPTY,
      setPageSection: (key, value) => set({ [key]: value }),
      resetPageContext: () => set({ ...EMPTY }),
    }),
    { name: "PageContextStore", enabled: import.meta.env.DEV },
  ),
);
