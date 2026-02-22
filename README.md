<p align="center">
  <img src="peek/public/logo.png" alt="Elastic Peek" width="200">
</p>

# Elastic Peek: AI Software Engineering Factory (Research Project)

This repository is a proof-of-concept **AI Software Engineering Factory** built on [elastic/ai-github-actions](https://github.com/elastic/ai-github-actions). It demonstrates how a suite of AI-powered GitHub Actions workflows can autonomously triage issues, review pull requests, propose fixes, and iterate on a real codebase with minimal human intervention.

Elastic Peek is both a way to look into your cluster and your data, and a look at the future of AI-powered software factories.

> **This is a research project, not an official Elastic product.**

## How it works

AI workflows in `.github/workflows/` handle the software engineering lifecycle:

- **Issue triage & duplicate detection** — new issues are classified, labeled, and checked for duplicates
- **Automated PR review** — pull requests receive AI-generated code reviews with actionable feedback
- **Fix proposals** — the factory can draft code changes in response to issues
- **Docs & text auditing** — scheduled patrols check documentation quality and prose clarity
- **Stale issue management** — aging issues are flagged and closed automatically

The workflows are powered by [elastic/ai-github-actions](https://github.com/elastic/ai-github-actions) and run in standard GitHub Actions CI — no custom infrastructure required.

---

## The Product: Elastic Peek

The codebase that the factory operates on is **Elastic Peek**, a lightweight, browser-only, backend-free, UI for interacting with Elasticsearch. It's powered by [Perses](https://perses.dev/) components and Elasticsearch [ES|QL](https://www.elastic.co/guide/en/elasticsearch/reference/current/esql.html).

### Live Demo

https://elastic.github.io/ai-github-actions-playground/

### Overview

Elastic Peek is a browser-based dashboard builder that connects directly to your Elasticsearch cluster. The static site queries Elasticsearch using ES|QL via the `_query` REST API — or optionally via a local proxy to avoid CORS.

- **Direct browser-to-Elasticsearch** — or via a local proxy to avoid CORS
- **ES|QL query editor** — write queries with syntax highlighting
- **No-code metrics explorer** — browse, filter, and chart metrics from UI selections
- **Recent query history** — quickly re-use successful queries in Discover and Panel Editor
- **Multiple visualization types** — time series, bar charts, pie charts, tables, stats, gauges
- **Drag-and-drop layout** — resize and rearrange panels freely
- **Persistent state** — dashboards save to localStorage automatically
- **Import/export** — share dashboards as JSON files
- **Dark and light themes**

### Quick Start

```bash
make setup   # install dependencies
make serve   # start dev server at http://localhost:3000
```

Or use the built-in proxy to avoid CORS (see [DEVELOPING.md](DEVELOPING.md#running-with-a-proxy)):

```bash
ES_URL=http://localhost:9200 make serve-proxy
```

### In-Product Docs

Use the **Docs** tab in the app for embedded documentation and search covering getting started, connecting to Elasticsearch, proxy mode, Query Lab, Metrics, and dashboard workflows.

## Further Reading

- [Development guide](DEVELOPING.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT
