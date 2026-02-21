# ES|QL Dashboard

A lightweight, static dashboarding tool powered by [Perses](https://perses.dev/) components and Elasticsearch [ES|QL](https://www.elastic.co/guide/en/elasticsearch/reference/current/esql.html).

## Live Demo

https://elastic.github.io/ai-github-actions-playground/

## Overview

ES|QL Dashboard is a browser-based dashboard builder that connects directly to your Elasticsearch cluster. No backend server required — the static site queries Elasticsearch using ES|QL via the `_query` REST API.

- **Direct browser-to-Elasticsearch** — no proxy, no middleware
- **ES|QL query editor** — write queries with syntax highlighting
- **Multiple visualization types** — time series, bar charts, pie charts, tables, stats, gauges
- **Drag-and-drop layout** — resize and rearrange panels freely
- **Persistent state** — dashboards save to localStorage automatically
- **Import/export** — share dashboards as JSON files
- **Dark and light themes**

## Quick Start

```bash
make setup   # install dependencies
make serve   # start dev server at http://localhost:3000
```

Or manually:

```bash
cd dashboard
npm install
npm run dev
```

## Prerequisites

- **Node.js** ≥ 18
- An **Elasticsearch** cluster with:
  - [CORS configured](https://www.elastic.co/guide/en/elasticsearch/reference/current/modules-network.html) to allow browser requests
  - An [API key](https://www.elastic.co/guide/en/elasticsearch/reference/current/security-api-create-api-key.html) with read permissions

## Connecting

1. Open the dashboard in your browser
2. Click **Connect to Elasticsearch**
3. Enter your Elasticsearch URL and API key
4. Click **Connect**

The connection is made directly from your browser. No credentials are sent to any intermediary server.

## Technology

| Component | Technology |
| --- | --- |
| Charts | [Apache ECharts](https://echarts.apache.org/) via [Perses](https://perses.dev/) component patterns |
| UI framework | [MUI](https://mui.com/) (same as Perses) |
| Frontend | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Build | [Vite](https://vite.dev/) |
| State | [Zustand](https://zustand.docs.pmnd.rs/) |
| Query editor | [CodeMirror](https://codemirror.net/) |
| Layout | [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) |

## Further Reading

- [Development guide](DEVELOPING.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT
