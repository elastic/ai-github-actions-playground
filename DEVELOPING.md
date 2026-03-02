# Development Guide

## Repository Structure

| Directory | What |
| --- | --- |
| `peek/` | Vite + React 18 + TypeScript frontend application |
| `peek/src/components/` | React UI components (panels, editors, dialogs) |
| `peek/src/components/visualizations/` | Chart and table visualization components |
| `peek/src/dashboards/` | Default dashboard definitions |
| `peek/src/docs/` | Embedded in-product documentation content |
| `peek/src/schemas.ts` | Zod validation schemas for import/export |
| `peek/src/services/` | Elasticsearch client and domain-specific type modules |
| `peek/src/store/` | Zustand state management |
| `peek/tests/unit/` | Unit tests (Vitest + jsdom) |
| `peek/tests/integration/` | Integration tests (Testcontainers + Elasticsearch) |
| `docker/` | nginx config template for the Docker proxy image |
| `.github/workflows/` | GitHub Actions workflows (CI, GitHub Pages deployment) |

## Prerequisites

- **Node.js** `^20.19.0` or `>=22.12.0` (required by Vite 7)
- **npm** `>=10` (bundled with Node.js 20/22)
- **GNU Make** (pre-installed on macOS/Linux)
- `.nvmrc` included — run `nvm use` or `fnm use` to activate the correct version

## Quick Start

```bash
make setup        # install Node.js dependencies (run this first)
make serve        # install deps + start Vite dev server with hot reload
make serve-proxy  # install deps + start dev server with Elasticsearch proxy (set ES_URL)
make build        # production build to peek/dist/
make lint         # Prettier + ESLint on changed files + full TypeScript type check (override: make lint BASE=HEAD~3)
make lint-full    # Prettier + ESLint + TypeScript type check on all files
make format       # auto-format changed files with Prettier (override: make format BASE=HEAD~3)
make format-full  # auto-format all files with Prettier
make check        # run all checks then build (equivalent to CI)
make docker-build # build the Docker image (proxy + dashboard)
make docker-run   # run the Docker container (set ES_URL)
make electron-dev   # start Electron app in dev mode (hot-reloads)
make electron-build # build Electron app (renderer + main process)
make electron-dist  # package Electron app for distribution (dmg/exe/AppImage)
make otel-up           # start local ES + EDOT collector + telemetry generators
make otel-logs         # tail EDOT collector logs
make otel-down         # stop and remove local OTel stack
make otel-cloud-up     # send OTel data to a remote cluster (set ES_URL, ES_API_KEY)
```

`make setup` must run first. `make serve` and `make serve-proxy` auto-install dependencies. A husky pre-commit hook runs Prettier + ESLint on staged files.

## Running with a Proxy

`make serve-proxy` starts Vite with a built-in proxy — no CORS configuration needed on Elasticsearch.

```bash
ES_URL=http://localhost:9200 make serve-proxy
```

Connect to `http://localhost:3000/_es` in the dashboard. The `/_es` prefix proxies all ES API requests to `ES_URL`.

## Electron Mode

Electron packages Peek as a native desktop app. ES requests go over IPC — no CORS or proxy needed.

```bash
make electron-dev    # dev mode with hot-reload + DevTools
make electron-build  # compile renderer + main process
make electron-dist   # package distributable (dmg/exe/AppImage) to peek/dist-packages/
```

| Runtime | CORS on ES? | Proxy? | Distribution |
| --- | --- | --- | --- |
| Browser (direct) | Yes | No | Static site / GitHub Pages |
| Browser + proxy | No | Yes | Docker image |
| Electron | No | No | Native desktop app |

## Architecture

Static SPA. Three runtimes: direct browser→ES (requires CORS), browser→proxy→ES (no CORS), or Electron IPC (no CORS). See § Electron Mode for the comparison table.

### Key Design Decisions

- **No backend**: The site is fully static. The Elasticsearch URL is stored in `localStorage` for persistence, while API key/password are stored in `sessionStorage` and cleared when the tab session ends. PIN-locked profiles encrypt credentials and persist them in `localStorage` instead, so they survive across sessions.
- **State persistence**: Dashboard state is persisted under the `elastic-peek` localStorage key via Zustand's `persist` middleware. Credentials are split into `sessionStorage` to limit exposure; PIN-locked profiles store encrypted credentials in `localStorage` under a `:enc` suffixed key. If you rename the persist key, you must add a one-time migration that reads the old key and writes it to the new one — otherwise existing users lose their saved state.
- **Perses-aligned**: Uses the same charting engine (Apache ECharts) and UI framework (MUI) as Perses. The theme system and chart patterns follow Perses conventions.
- **ES|QL native**: Queries are written in ES|QL and sent directly to the `_query` endpoint. The response format (columnar JSON) is transformed into chart-compatible structures client-side.

## Adding a Visualization Type

1. Create a new component in `peek/src/components/visualizations/`.
2. Add a descriptor module in `peek/src/components/visualizations/registry/` that exports a default `VizRegistryDescriptor`.
3. Add the descriptor's `type` string to the `VisualizationType` union in `peek/src/types.ts` (the string must exactly match the descriptor's exported `type` value).
4. Give the descriptor a unique `order` value so it appears in the desired picker order.

`vizRegistry.tsx` discovers descriptor modules automatically with `import.meta.glob`, so no central registration file edits are required for new visualization types.

## Perses Architecture

Peek uses [Perses](https://perses.dev) as its charting framework (CNCF project, ECharts-based). For visual/theming rules (tooltip style, colors, series behavior), see DESIGN_LANGUAGE.md § Charts. For the full migration roadmap, see PERSES_MIGRATION_PLAN.md.

**Architecture layers:**

- **Data model** — dashboards serialize to the Perses resource format (`kind: "Dashboard"`, panels as `kind: "Panel"` with plugin kinds). Adapters in `services/perses/dashboardAdapters.ts` convert between internal `DashboardDefinition` and the Perses wire format.
- **Panel plugins** — each visualization type maps to a Perses plugin kind via `VISUALIZATION_TO_PLUGIN_KIND` in the adapter layer (`TimeSeriesChart`, `StatChart`, `GaugeChart`, `BarChart`, `TablePanel`, `PieChart`, `ScatterChart`, `HeatMapChart`, `HistogramChart`, `MarkdownPanel`).
- **Viz registry** — `vizRegistry.tsx` and `components/perses/panelRegistry.ts` use the same `VizRegistryEntry` interface. Registry entries are auto-discovered from `visualizations/registry/*.tsx`.
- **Rendering** — charts render through `EChartWrapper`, which wraps the ECharts core that Perses itself uses internally. Do not import ECharts directly in new chart components; use `EChartWrapper` or Perses's `@perses-dev/components` `EChart` component.
- **Theming** — `useEChartTheme()` produces ECharts-compatible options from MUI palette tokens. This hook is modeled on Perses's `generateChartsTheme` and will be replaced by Perses's `ChartsProvider` context once the migration completes. Until then, all chart theming flows through this single hook — charts never set their own colors.

**Code-structure rules for chart components:**

- Chart components receive data via `VizRendererProps`. They do not fetch data — the panel container handles queries.
- New chart types must be registered as a `VizRegistryDescriptor` in `visualizations/registry/`. One file per chart type.

## Adding a New Elasticsearch Endpoint

The Elasticsearch service layer in `peek/src/services/es/` is organized into **domain-specific type modules** so that contributors working on unrelated ES capabilities (e.g. security vs. ingest) do not need to edit the same files.

| File | Purpose |
| --- | --- |
| `esqlTypes.ts` | ES\|QL query/response types |
| `clusterTypes.ts` | Cluster health, nodes, stats, allocation, recovery, ILM, SLM types |
| `indicesTypes.ts` | Index, data stream, field capability types |
| `securityTypes.ts` | Users, roles, API keys, capabilities types |
| `ingestTypes.ts` | Ingest pipeline types |
| `profilingTypes.ts` | Profiling types |
| `client.ts` | `ElasticsearchClient` class (methods + core connection/error types) |
| `index.ts` | Barrel re-exports — uses `export type *` from domain modules |

**To add types for a new or existing ES endpoint domain:**

1. Add your types to the relevant `*Types.ts` file (e.g. `securityTypes.ts` for a new security API type). If the domain doesn't exist yet, create a new `<domain>Types.ts` file and add a `export type * from "./<domain>Types"` line to `index.ts`.
2. Add the corresponding method to `ElasticsearchClient` in `client.ts`, importing the type from the domain file.
3. If you created a new domain type file, add a `export type { ... } from "./<domain>Types"` re-export block to `client.ts` for backward compatibility.

This structure ensures that **adding types to an existing domain** only touches the domain's type file and `client.ts` (for the method), and never requires editing the barrel `index.ts`.

## Docker

Self-contained image: nginx serves the built dashboard and proxies `/_es/*` to Elasticsearch (no CORS needed).

```bash
make docker-build                              # build the image
make docker-run                                # run against localhost:9200
ES_URL=https://my-cluster:9200 make docker-run # run against a remote cluster
```

Connect to `http://localhost:8080/_es`. See `docker/nginx.conf.template` for proxy config.

## OTel Telemetry Stack

Generate real telemetry in `metrics-*`, `traces-*`, and `logs-*` indices using an EDOT collector and synthetic generators.

### Local

```bash
make otel-up      # ES (localhost:9200) + EDOT collector + otelgen traces/logs + Fleet agent simulator
make otel-logs    # tail collector logs
make otel-down    # stop everything
```

### Remote

```bash
ES_URL=https://my-cluster.es.cloud:443 ES_API_KEY=... make otel-cloud-up
make otel-cloud-down
```

### OTLP Fixture Capture & Replay

Pre-captured OTLP data in `peek/fixtures/otlp/` — faster and deterministic, no generators needed.

```bash
make otel-replay-up    # start ES + EDOT collector in replay mode
make otel-replay       # replay fixtures + seed non-OTLP data (web_logs, orders, pipelines)
make test-e2e-live     # Playwright tests against real data
make otel-replay-down  # stop everything
```

Re-capture: `make otel-capture`, wait ~30s, `make otel-capture-down`. See `peek/fixtures/otlp/README.md`.

## Fleet Harness

Real Fleet Server stack with enrolled Elastic Agents. Allow 3-5 minutes for full initialization.

```bash
make fleet-harness-up     # ES (localhost:9220, elastic/changeme) + Kibana + Fleet Server + 2 agents
make fleet-harness-down   # stop everything
make fleet-harness-logs   # tail Fleet Server logs
```

Connect Peek to `http://localhost:9220` with credentials `elastic` / `changeme`.

Data streams: `metrics-fleet_server.agent_status-default`, `metrics-fleet_server.agent_versions-default`, `logs-fleet_server.output_health-default`, `logs-elastic_agent-default`, `metrics-elastic_agent.*-default`.

## Testing

```bash
make test-unit        # fast, no Docker needed — primary CI gate
make test-integration # requires Docker (spins up Elasticsearch via Testcontainers)
make test-e2e         # Playwright browser tests (starts dev server automatically)
make test             # run all (unit, integration, e2e)
```

Unit tests run in jsdom via Vitest. Integration tests use Testcontainers (**Docker must be running**). E2E tests use Playwright — run `npx playwright install chromium` if the browser binary is missing.

E2E with live data:

```bash
make otel-up && ES_URL=http://localhost:9200 make test-e2e && make otel-down
```

### Exploratory Testing Agents

Nine scheduled agents creatively explore the app with Playwright. Each owns a
domain of the application and invents novel interaction scenarios every run.
They do NOT run pre-written test suites — deterministic E2E tests run in CI.

| Agent | Domain | Workflow |
| --- | --- | --- |
| Connection & Onboarding | Connection dialog, auth tabs, disconnect/reconnect | `explore-connection.yml` |
| Metrics & Charts | Metric search, chart rendering, time ranges | `explore-metrics.yml` |
| Traces & Service Map | Span trees, service map, trace-to-query pivot | `explore-traces.yml` |
| Query Lab & Console | ES\|QL queries, result tables, API Console | `explore-query-lab.yml` |
| Indices, Data Streams & Pipelines | Table sorting, detail views, data management | `explore-data-management.yml` |
| Mobile Responsiveness | Mobile viewport layout, tap targets, responsive breakpoints | `explore-mobile.yml` |
| Live Elasticsearch | All pages with real OTel data and a real cluster | `explore-live-es.yml` |
| Customer: Feature Gap Review | Missing features, feature requests, comparison to Kibana/Grafana/Elasticvue | `explore-customer-feedback.yml` |
| Design: Modern UI Review | Design modernization, spacing, typography, cards, tables, empty states, loading patterns | `ui-designer-review.yml` |

Agents use **Playwright MCP tools** (`browser_navigate`, `browser_click`,
`browser_type`, `browser_snapshot`, `browser_take_screenshot`) for interactive
browser exploration. They do NOT write Node.js scripts — the MCP tools allow
step-by-step interaction where the agent sees the page state after each action
and adapts. They report only genuine bugs.

#### Handling failures during exploration

- Do not retry the same action more than twice — the page state is different from expected.
- Diagnose before moving on: use `browser_take_screenshot` and `browser_snapshot` to see what's on the page.
- Adapt (different selector/path) or report the failure as a finding.
- Never claim you verified something you didn't — if it failed and you skipped it, say so.

### CI

`make ci` runs lint + unit tests + build on every push to `main` and on PRs touching `peek/**`. Integration tests run locally only (`make test-integration`). Production builds deploy to GitHub Pages via `deploy-pages.yml`.

## Engineering Standards

Many rules (no `any`, `import type`, import ordering, no duplicate imports) are enforced automatically by ESLint and TypeScript — see `peek/eslint.config.js` and `peek/tsconfig.json`. This section covers the design guidance that requires human judgment.

### TypeScript

- Prefer discriminated unions for state modeling (e.g., `{ status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: Error }`) over optional fields.
- Prefer `interface` for object shapes and `type` for unions, intersections, and mapped types.

### React

- Prefer composition (children, render props, slots) over prop drilling. If a prop passes through a component that doesn't use it, restructure.
- Don't use `useEffect` to synchronize derived state — compute it during render instead.
- A component with more than 8 props or 200 lines is a code smell. Consider decomposing.

### State Management

Use the simplest solution that works, in this order: `useState` → derived state (compute during render) → `useReducer` → React Context → URL state → Zustand.

### UI Components

Shared layout and feedback components (`EmptyState`, `ContentSkeleton`, `PageHeader`) are specified in DESIGN_LANGUAGE.md § Components. Use them instead of one-off implementations.

### Testing Standards

- Test behavior (what the user sees), not implementation details (internal state, hook call counts).
- Test error states, loading states, and empty states — not just the happy path.
- Include at least one `vitest-axe` accessibility check per component test suite.
- Prefer component tests (`@testing-library/react` + `userEvent`) over E2E for rendering and interaction.
- Mock at boundaries (`fetch`, `localStorage`, `echarts/core`); everything else uses real code paths.
- No trivial tests — skip "renders without crashing" with zero assertions.

### Banned Code Patterns

See DESIGN_LANGUAGE.md § Banned Patterns for visual/design bans (inline hex, drop shadows, disallowed variants, etc.).

```tsx
// ❌ Barrel MUI imports (breaks tree-shaking)
import { Box, Typography } from '@mui/material';
// ✅
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// ❌ Direct ECharts import in chart components
import * as echarts from 'echarts/core';
// ✅ Use the wrapper or Perses component
import EChartWrapper from './EChartWrapper';

// ❌ Fetching data inside a chart component
useEffect(() => { fetchData(query) }, [query]);
// ✅ Chart components receive data via VizRendererProps — the panel container fetches
```

## Accessibility Standards

This project targets **WCAG 2.2 Level AA** conformance. For contrast ratios, color usage rules, and visual accessibility requirements, see DESIGN_LANGUAGE.md § Accessibility.

Many structural issues (missing alt text, invalid ARIA, click without keyboard, missing labels) are caught by `eslint-plugin-jsx-a11y` and `vitest-axe`. This section covers the implementation guidance that automation cannot catch.

### Keyboard & Focus

- Every interactive element must be keyboard-operable (Tab to focus, Enter/Space to activate, Escape to dismiss overlays).
- No keyboard traps. Modal dialogs trap focus and provide Escape to close.
- Manage focus on route changes (move to main content or page heading) and dialog open/close (return focus to the trigger element).

### Semantic HTML & ARIA

- Use correct elements: `<button>` for actions, `<a>` for navigation, never `<div onClick>`. Logical heading hierarchy, no skipped levels, one `<h1>` per page.
- Prefer native HTML semantics over ARIA. If ARIA is used, implement the full contract (e.g., `role="tablist"` requires `role="tab"` children with `aria-selected`, arrow key navigation, and linked `role="tabpanel"`).
- Use landmark regions (`<main>`, `<nav>`, `<header>`, `<footer>`).

### Forms

- Every form input needs a visible `<label>` (via `htmlFor`). Error messages linked to inputs via `aria-describedby`. Group related inputs with `<fieldset>` and `<legend>`.

### Motion

- Respect `prefers-reduced-motion` — reduce or remove animations when this media query matches.

## PR Checklist (UI Changes)

For any PR that modifies UI, verify the items that CI cannot check automatically:

- [ ] Interactive elements are keyboard accessible (tab, activate, dismiss)
- [ ] Color contrast meets DESIGN_LANGUAGE.md § Accessibility ratios
- [ ] Color is not the sole indicator of meaning
- [ ] Focus is managed correctly on route changes and dialog open/close
- [ ] Loading, empty, and error states are handled and designed
- [ ] Heading hierarchy is logical (no skipped levels)
