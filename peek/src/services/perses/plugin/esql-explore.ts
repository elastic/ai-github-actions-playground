import type { Plugin } from "@perses-dev/plugin-system";

/**
 * Spec for the ES|QL explore plugin.
 */
export interface ESQLExploreSpec {
  /** ES|QL query text for ad-hoc exploration. */
  query: string;
  /** Optional datasource name. Omit to use the default Elasticsearch datasource. */
  datasource?: string;
}

/**
 * Perses ExplorePlugin shape.
 *
 * The `ExplorePlugin` interface is not exported from `@perses-dev/plugin-system`
 * but is defined internally. We mirror the interface here to avoid depending on
 * an internal module path.
 */
interface ExplorePlugin<Spec> extends Plugin<Spec> {
  ExploreComponent: React.ComponentType<{ spec: Spec }>;
}

/**
 * Perses ExplorePlugin for ES|QL.
 *
 * Provides the initial options factory for the explore UI.  The
 * `ExploreComponent` is left as a placeholder — the host application
 * provides its own query lab / console UI and does not render the
 * Perses explore view directly.  Registering the plugin is still
 * necessary so that the Perses runtime recognises ES|QL as a valid
 * explore target when enumerating available plugin kinds.
 */
export const ESQLExplore: ExplorePlugin<ESQLExploreSpec> = {
  createInitialOptions: () => ({
    query: "FROM logs-* | LIMIT 100",
  }),

  ExploreComponent: () => null,
};

export const ESQL_EXPLORE_KIND = "ESQLExplore";
