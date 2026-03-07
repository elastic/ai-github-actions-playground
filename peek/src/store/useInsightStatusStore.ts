import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Global insight status store.
 *
 * Tracks the current state of insight generation across the active page.
 * The {@link InsightSlotProvider} syncs page-level insight data into this
 * store so that global UI (e.g. the footer status indicator) can display
 * loading progress, insight counts, and navigation controls.
 */
export interface InsightStatusState {
  /** Whether insights are currently being generated. */
  loading: boolean;
  /** Total number of generated insights on the current page. */
  totalInsights: number;
  /** Set of slot IDs that have been dismissed in this session. */
  dismissedSlotIds: ReadonlySet<string>;
  /** Error message if generation failed. */
  error: string | null;
  /** Short status message shown in the footer (e.g. "Analyzing cluster health…"). */
  statusMessage: string | null;

  // ── Actions ──────────────────────────────────────────────────────────

  /** Batch-update status fields from the page-level insight provider. */
  syncFromProvider: (patch: {
    loading: boolean;
    totalInsights: number;
    error: string | null;
  }) => void;

  /** Mark a slot as dismissed. */
  dismissSlot: (slotId: string) => void;

  /** Clear all dismissed slots (e.g. on page navigation). */
  clearDismissals: () => void;

  /** Set the human-readable status message. */
  setStatusMessage: (message: string | null) => void;

  /** Reset all insight status state. */
  resetInsightStatus: () => void;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

const DEFAULT_STATE = {
  loading: false,
  totalInsights: 0,
  dismissedSlotIds: EMPTY_SET,
  error: null as string | null,
  statusMessage: null as string | null,
};

export const useInsightStatusStore = create<InsightStatusState>()(
  devtools(
    (set) => ({
      ...DEFAULT_STATE,

      syncFromProvider: ({ loading, totalInsights, error }) =>
        set({ loading, totalInsights, error }),

      dismissSlot: (slotId) =>
        set((state) => {
          const next = new Set(state.dismissedSlotIds);
          next.add(slotId);
          return { dismissedSlotIds: next };
        }),

      clearDismissals: () => set({ dismissedSlotIds: EMPTY_SET }),

      setStatusMessage: (message) => set({ statusMessage: message }),

      resetInsightStatus: () => set(DEFAULT_STATE),
    }),
    { name: "InsightStatusStore", enabled: import.meta.env.DEV },
  ),
);
