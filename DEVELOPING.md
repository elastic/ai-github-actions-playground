# Development Guide

## Repository Structure

| Directory | What |
| --- | --- |
| `dashboard/` | Vite + React 18 + TypeScript frontend application |
| `dashboard/src/components/` | React UI components (panels, editors, dialogs) |
| `dashboard/src/components/visualizations/` | Chart and table visualization components |
| `dashboard/src/services/` | Elasticsearch ES|QL client |
| `dashboard/src/store/` | Zustand state management |
| `dashboard/tests/integration/` | Integration tests (Testcontainers + Elasticsearch) |
| `.github/workflows/` | GitHub Actions workflows (CI, GitHub Pages deployment) |

## Quick Start

```bash
make setup   # install Node.js dependencies
make serve   # start Vite dev server with hot reload
make build   # production build to dashboard/dist/
make lint    # Prettier + ESLint + TypeScript type checking
make format  # auto-format code with Prettier
make check   # run all checks then build (equivalent to CI)
```

## Architecture

The dashboard is an entirely static single-page application. All Elasticsearch queries are made directly from the browser using the ES|QL `POST /_query` REST API.

```
┌─────────────┐    ES|QL     ┌────────────────────┐
│   Browser    │ ──────────▶  │   Elasticsearch    │
│  (static)    │ ◀──────────  │   cluster          │
└─────────────┘    JSON       └────────────────────┘
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

1. Create a new component in `dashboard/src/components/visualizations/`
2. Add the type to the `VisualizationType` union in `dashboard/src/types.ts`
3. Register it in `dashboard/src/components/visualizations/Visualization.tsx`
4. Add the toggle option in `dashboard/src/components/PanelEditor.tsx`

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

The `ci.yml` workflow runs lint, build, and integration tests on every push to `main` and on every PR that touches `dashboard/**`. The integration test job pulls the Elasticsearch Docker image and runs the same `make test` target.

## Code Quality

The project enforces formatting, linting, and type safety. All three are checked in CI on every pull request.

| Tool | Purpose | Config |
| --- | --- | --- |
| **Prettier** | Code formatting | `dashboard/.prettierrc` |
| **ESLint** | Static analysis (TypeScript + React rules) | `dashboard/eslint.config.js` |
| **TypeScript** | Type checking (`strict`, `noUnusedLocals`, `noUnusedParameters`) | `dashboard/tsconfig.json` |

```bash
make lint     # run all checks (Prettier, ESLint, TypeScript)
make format   # auto-fix formatting
```

## Building for Production

```bash
make build
```

Output goes to `dashboard/dist/`. This directory is deployed to GitHub Pages by the `deploy-pages.yml` workflow on every push to `main`.
