# ADR: Perses-complete migration contract

- Status: Accepted
- Date: 2026-03-03
- Owners: Peek maintainers

## Context

Peek is mid-migration from direct ECharts usage toward Perses-native panel rendering. Until final cleanup lands, contributors need a clear contract for what "Perses-complete" means and what guardrails must stay enforced.

## Decision

A Perses-complete codebase satisfies all of these boundaries:

1. **No runtime `echarts/*` imports in app code** (`peek/src/**`), except the explicit adapter escape hatch `peek/src/components/perses/PersesEChartWrapper.tsx` while migration is in progress.
2. **Visualization renderers are Perses panel abstractions only** — chart components should integrate through Perses panel/plugin seams rather than direct ECharts APIs.
3. **Feature pages use shared Perses chart primitives** instead of page-local direct charting runtime wiring.

## Acceptance checks

The following checks encode this contract:

- ESLint rule `peek/no-direct-echarts-import` rejects all direct ECharts imports in app code, including type-only imports, with the adapter/test exceptions above.
- Unit tests for `no-direct-echarts-import` verify:
  - wrapper/test import exceptions remain allowed;
  - runtime imports in app code fail;
  - type-only imports in app code fail.

## Consequences

- New visualization and feature-page chart work must be implemented on Perses panel primitives.
- Migration work can use the adapter escape hatch temporarily, but no new non-wrapper ECharts import paths are allowed.
