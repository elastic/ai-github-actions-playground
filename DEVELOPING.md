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
| `peek/src/services/` | Elasticsearch ES|QL client |
| `peek/src/store/` | Zustand state management |
| `peek/tests/unit/` | Unit tests (Vitest + jsdom) |
| `peek/tests/integration/` | Integration tests (Testcontainers + Elasticsearch) |
| `docker/` | nginx config template for the Docker proxy image |
| `.github/workflows/` | GitHub Actions workflows (CI, GitHub Pages deployment) |

## Quick Start

```bash
make setup        # install Node.js dependencies (run this first)
make serve        # install deps + start Vite dev server with hot reload
make serve-proxy  # install deps + start dev server with Elasticsearch proxy (set ES_URL)
make build        # production build to peek/dist/
make lint         # Prettier + ESLint + TypeScript type checking
make format       # auto-format code with Prettier
make check        # run all checks then build (equivalent to CI)
make docker-build # build the Docker image (proxy + dashboard)
make docker-run   # run the Docker container (set ES_URL)
make otel-harness-up   # start local Elasticsearch + OTel host metrics harness
make otel-harness-logs # tail logs from the already-running harness started by otel-harness-up
make otel-harness-down # stop and remove OTel host metrics harness
```

> **Note:** `make serve` and `make serve-proxy` auto-install dependencies. The other targets (`lint`, `format`, `build`, `test-*`) assume dependencies are already installed — run `make setup` once first.

> **Pre-commit hook:** `make setup` (or `npm install` inside `peek/`) also installs a [husky](https://typicode.github.io/husky/) pre-commit hook that automatically runs Prettier (format) and ESLint (lint) on staged files via [lint-staged](https://github.com/lint-staged/lint-staged). This keeps committed code consistently formatted and lint-free.

## Running with a Proxy

Use `make serve-proxy` (or `ES_URL=... npm run dev` in the `peek/` directory) to start the Vite dev server with a built-in proxy. The proxy forwards `/_query` requests to your Elasticsearch cluster, so no CORS configuration is needed on Elasticsearch.

```bash
ES_URL=http://localhost:9200 make serve-proxy
```

Then enter `http://localhost:3000` as the Elasticsearch URL when connecting the dashboard. The dev server will transparently proxy all `/_query` calls to `ES_URL`.

```
┌─────────────┐    /_query      ┌──────────────────┐    /_query      ┌────────────────────┐
│   Browser    │ ─────────────▶  │  Vite dev server  │ ─────────────▶  │   Elasticsearch    │
│              │ ◀─────────────  │  (localhost:3000) │ ◀─────────────  │   cluster          │
└─────────────┘    JSON          └──────────────────┘    JSON          └────────────────────┘
```

## Architecture

The dashboard is a static single-page application. Elasticsearch queries are made directly from the browser, or via a local proxy that avoids CORS.

**Direct mode** (requires CORS on Elasticsearch):
```
┌─────────────┐    ES|QL     ┌────────────────────┐
│   Browser    │ ──────────▶  │   Elasticsearch    │
│  (static)    │ ◀──────────  │   cluster          │
└─────────────┘    JSON       └────────────────────┘
```

**Proxy mode** (no CORS required):
```
┌─────────────┐    /_query      ┌───────────┐    /_query      ┌────────────────────┐
│   Browser    │ ─────────────▶  │   Proxy   │ ─────────────▶  │   Elasticsearch    │
│              │ ◀─────────────  │  (local)  │ ◀─────────────  │   cluster          │
└─────────────┘    JSON          └───────────┘    JSON          └────────────────────┘
```

### Key Design Decisions

- **No backend**: The site is fully static. The Elasticsearch URL is stored in `localStorage` for persistence, while API key/password are stored in `sessionStorage` and cleared when the tab session ends.
- **State persistence**: Dashboard state is persisted under the `elastic-peek` localStorage key via Zustand's `persist` middleware. Credentials are split into `sessionStorage` to limit exposure. If you rename the persist key, you must add a one-time migration that reads the old key and writes it to the new one — otherwise existing users lose their saved state.
- **Perses-aligned**: Uses the same charting engine (Apache ECharts) and UI framework (MUI) as Perses. The theme system and chart patterns follow Perses conventions.
- **ES|QL native**: Queries are written in ES|QL and sent directly to the `_query` endpoint. The response format (columnar JSON) is transformed into chart-compatible structures client-side.

## Adding a Visualization Type

1. Create a new component in `peek/src/components/visualizations/`
2. Add the type to the `VisualizationType` union in `peek/src/types.ts`
3. Register it in `peek/src/components/visualizations/Visualization.tsx`
4. Add the toggle option in `peek/src/components/PanelEditor.tsx`

## Docker

The `Dockerfile` produces a self-contained image that serves the built dashboard with nginx and proxies `/_query` to Elasticsearch. No CORS configuration on Elasticsearch is required.

```bash
make docker-build                              # build the image
make docker-run                                # run against host Elasticsearch (port 9200)
ES_URL=https://my-cluster:9200 make docker-run # run against a remote cluster
```

Or with Docker Compose:

```bash
ES_URL=http://my-elasticsearch:9200 docker compose up
```

Open `http://localhost:8080` and enter `http://localhost:8080` as the Elasticsearch URL. The nginx proxy inside the container forwards `/_query` requests to `ES_URL`. See `docker/nginx.conf.template` for the proxy configuration.

## OTel Host Metrics Harness

Use this harness to generate real host metrics in a local `metrics-*` index so query work can run against incoming telemetry instead of seeded fixtures.

```bash
make otel-harness-up
```

This starts:
- Elasticsearch (`http://localhost:9200`)
- OpenTelemetry Collector (`hostmetrics` receiver + Elasticsearch exporter)

Stop it with:

```bash
make otel-harness-down
```

Optional:

```bash
make otel-harness-logs
```

Quick data check:

```bash
curl -s -X POST 'http://localhost:9200/_query' \
  -H 'Content-Type: application/json' \
  -d '{"query":"FROM metrics-hostmetricsreceiver-default | STATS count = COUNT(*) BY dataset = data_stream.dataset, metric_type = type | SORT count DESC"}'
```

## Testing

```bash
make test-unit        # fast, no Docker needed — primary CI gate
make test-integration # requires Docker (spins up Elasticsearch via Testcontainers)
make test             # run both
```

Unit tests (`peek/tests/unit/`) run in jsdom via Vitest. Integration tests (`peek/tests/integration/`) use [Testcontainers](https://testcontainers.com/) to start a real Elasticsearch instance, seed test data, and run ES|QL queries through the app's `executeEsql` service. **Docker must be running** for integration tests.

### Testing Philosophy

- **Test behavior, not implementation** — assert on what the user sees and what the system does, not internal wiring.
- **Fast by default** — all unit and component tests run in jsdom via Vitest with no browser, Docker, or network.
- **Component tests over E2E** — render real React components with `@testing-library/react` + `userEvent` to catch rendering bugs and interaction flows.
- **No trivial tests** — every test should describe a behavior someone cares about; skip "renders without crashing" tests with zero assertions.
- **Mock at boundaries** — mock `fetch`, `localStorage`, `echarts/core`; everything else uses real code paths.

### CI

`make ci` runs lint + unit tests + build on every push to `main` and on every PR that touches `peek/**`. Integration tests are not part of the default CI pipeline — run them locally with `make test-integration`.

Production builds (`make build`) output to `peek/dist/` and are deployed to GitHub Pages by the `deploy-pages.yml` workflow on every push to `main`.
