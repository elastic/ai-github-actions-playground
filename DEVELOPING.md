# Development Guide

## Repository Structure

| Directory | What |
| --- | --- |
| `peek/` | Vite + React 18 + TypeScript frontend application |
| `peek/src/components/` | React UI components (panels, editors, dialogs) |
| `peek/src/components/visualizations/` | Chart and table visualization components |
| `peek/src/services/` | Elasticsearch ES|QL client |
| `peek/src/store/` | Zustand state management |
| `peek/tests/integration/` | Integration tests (Testcontainers + Elasticsearch) |
| `docker/` | nginx config template for the Docker proxy image |
| `.github/workflows/` | GitHub Actions workflows (CI, GitHub Pages deployment) |

## Quick Start

```bash
make setup        # install Node.js dependencies
make serve        # start Vite dev server with hot reload
make serve-proxy  # start dev server with Elasticsearch proxy (set ES_URL)
make build        # production build to peek/dist/
make lint         # Prettier + ESLint + TypeScript type checking
make format       # auto-format code with Prettier
make check        # run all checks then build (equivalent to CI)
make docker-build # build the Docker image (proxy + dashboard)
make docker-run   # run the Docker container (set ES_URL)
```

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
- **Perses-aligned**: Uses the same charting engine (Apache ECharts) and UI framework (MUI) as Perses. The theme system and chart patterns follow Perses conventions.
- **ES|QL native**: Queries are written in ES|QL and sent directly to the `_query` endpoint. The response format (columnar JSON) is transformed into chart-compatible structures client-side.

### Visualization Pipeline

1. User writes an ES|QL query in the panel editor
2. Query is sent to Elasticsearch via `POST /_query?format=json`
3. Response columns are classified by type (date, numeric, keyword)
4. Column types determine how data maps to chart axes and series
5. ECharts renders the visualization with theme-matched styling

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

Open `http://localhost:8080` and enter `http://localhost:8080` as the Elasticsearch URL. The nginx proxy inside the container forwards `/_query` requests to `ES_URL`.

### How the proxy works

- The `Dockerfile` builds the dashboard with `VITE_BASE_PATH=/` (root-relative URLs) and serves it from nginx.
- `docker/nginx.conf.template` is processed at container startup; `${ES_URL}` is substituted with the `ES_URL` environment variable.
- nginx routes `/_query` to Elasticsearch and serves everything else as static files.

## Testing

Integration tests use [Testcontainers](https://testcontainers.com/) to spin up a real Elasticsearch instance in Docker, load test data, and run ES|QL queries through the same `executeEsql` service the dashboard uses.

### Prerequisites

- **Docker** must be running locally

### Running Tests

```bash
make test
```

This starts an Elasticsearch 8.17 container, seeds two indices (`web_logs` and `orders`) with sample data, and runs the test suite via Vitest. Container lifecycle is managed automatically — it starts before the first test and stops after the last.

### Test Structure

| File | What |
| --- | --- |
| `tests/integration/setup.ts` | Container startup, ES client creation, test data seeding |
| `tests/integration/esql.test.ts` | ES|QL query tests against our `executeEsql` service |

### What's Tested

- Connection testing (`SHOW INFO`, bad URL)
- Basic queries (`FROM`, `WHERE`, `SORT`, `LIMIT`)
- Aggregations (`COUNT`, `SUM`, `AVG`, grouped `STATS ... BY`)
- Computed columns (`EVAL`)
- Response structure (column names, types for keyword/integer/long/double)
- Error handling (invalid syntax returns structured `EsqlError`)

### CI

The `ci.yml` workflow runs lint, build, and integration tests on every push to `main` and on every PR that touches `peek/**`. The integration test job pulls the Elasticsearch Docker image and runs the same `make test` target.

## Code Quality

The project enforces formatting, linting, and type safety. All three are checked in CI on every pull request.

| Tool | Purpose | Config |
| --- | --- | --- |
| **Prettier** | Code formatting | `peek/.prettierrc` |
| **ESLint** | Static analysis (TypeScript + React rules) | `peek/eslint.config.js` |
| **TypeScript** | Type checking (`strict`, `noUnusedLocals`, `noUnusedParameters`) | `peek/tsconfig.json` |

```bash
make lint     # run all checks (Prettier, ESLint, TypeScript)
make format   # auto-fix formatting
```

## Building for Production

```bash
make build
```

Output goes to `peek/dist/`. This directory is deployed to GitHub Pages by the `deploy-pages.yml` workflow on every push to `main`.
