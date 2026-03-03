# ADR: Perses-complete visualization contract

## Status
Accepted

## Context
Issue #589 tracks the final migration from legacy visualization registry wiring and direct ECharts coupling to Perses-owned panel abstractions.

## Decision
The app treats Perses panel abstractions as the only supported visualization contract.

### Contract
- App code must not import `echarts/*` directly, including type-only imports.
- The only app-level escape hatch for direct ECharts imports is `peek/src/components/perses/PersesEChartWrapper.tsx`.
- Dashboard visualization type lists and chart default options resolve from the Perses panel registry.
- New visualization behavior must be registered through `peek/src/components/perses/panelRegistry.ts`.

## Exit checklist
A migration is "Perses-complete" only when all of the following are true:
- [ ] No direct app imports from `echarts/*` outside the explicit wrapper and tests.
- [ ] `peek/eslint-plugin-peek/rules/no-direct-echarts-import.js` fails on both runtime and type-only imports.
- [ ] `peek/src/schemas.ts` and `peek/src/components/chartDefaults.ts` both source panel types/defaults from Perses registry APIs.
- [ ] The lint rule unit tests include a failing case for type-only imports in app code.

## Consequences
- Visualization components can still hold chart instance refs for export/click handlers, but they depend on local adapter types instead of `echarts` package types.
- Registry behavior is centralized on Perses registry modules, reducing migration drift between schema/defaults and renderer wiring.
