import type { InstrumentationScoreRule } from "../types";

import { resourceRules } from "./resource";
import { spanRules } from "./span";

/**
 * All instrumentation score rules that can be evaluated from trace data.
 *
 * Note: The full spec defines additional rules for Metrics (MET-*), Logs (LOG-*),
 * and SDK (SDK-*) targets. Those are omitted here because they require data
 * sources beyond what is available from the traces index. They can be added
 * as the application gains access to metrics and logs indices.
 */
export const INSTRUMENTATION_SCORE_RULES: InstrumentationScoreRule[] = [
  ...resourceRules,
  ...spanRules,
];
