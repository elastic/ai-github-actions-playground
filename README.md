# Elastic Peek

A lightweight, static dashboarding tool powered by [Perses](https://perses.dev/) components and Elasticsearch [ES|QL](https://www.elastic.co/guide/en/elasticsearch/reference/current/esql.html).

## Live Demo

https://elastic.github.io/ai-github-actions-playground/

## Overview

Elastic Peek is a browser-based dashboard builder that connects directly to your Elasticsearch cluster. The static site queries Elasticsearch using ES|QL via the `_query` REST API — or optionally via a local proxy to avoid CORS.

- **Direct browser-to-Elasticsearch** — or via a local proxy to avoid CORS
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

Or use the built-in proxy to avoid CORS (see [Running with a Proxy](#running-with-a-proxy)):

```bash
ES_URL=http://localhost:9200 make serve-proxy
```

Or manually:

```bash
cd dashboard
npm install
npm run dev
```

## In-Product Docs

Use the **Docs** tab in the app for embedded documentation and search.

The docs include:
- Getting started and prerequisites
- Connecting to Elasticsearch
- Running with proxy mode
- Dashboard and Discover workflows
- Testing and quality checks

## Further Reading

- [Development guide](DEVELOPING.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT
