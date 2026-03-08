# About Elastic Peek

Elastic Peek is part of an AI Software Engineering Factory proof of concept built on elastic/ai-github-actions. AI-powered workflows autonomously triage issues, review pull requests, and iterate on this codebase.

The app itself is a lightweight, browser-based Elasticsearch dashboard builder created entirely by AI agents.

There is no backend server — your browser talks to Elasticsearch via the `_query` REST API. Credentials never leave your machine.

You can also run a local proxy to avoid configuring CORS on your cluster.

## Key features

- **Dashboard builder** — create, arrange, and share panels with drag-and-drop layout and ES|QL-powered queries.
- **Observability views** — dedicated pages for Logs, Metrics, Traces, Profiling, Services, Kubernetes, and Hosts.
- **Cluster administration** — browse indices, data streams, ingest pipelines, nodes, ILM policies, templates, and more.
- **Security** — manage users, roles, and API keys. Investigate entities with AI-powered timeline analysis.
- **AI Assistant** — Chat with an LLM that has access to your cluster data, with built-in tools for querying, navigation, and analysis.
- **No backend** — all data stays in your browser and goes directly to Elasticsearch.

## Getting started

1. Open the app and click the connection chip to configure your Elasticsearch URL and credentials.
2. Use the sidebar to navigate between pages.
3. Start with **Dashboards** to build your first panel, or explore **Cluster Overview** for a health snapshot.
4. Visit **Docs** anytime for detailed guidance on any feature.

## Copilot PAT setup for workflow automation

If you use the AI GitHub Actions workflows, add a repository secret named `COPILOT_GITHUB_TOKEN` backed by a GitHub Personal Access Token (PAT) that has access to the repository features your workflows need.

This is the same for public and private repositories; for private repos, ensure the PAT is authorized for that private repository or organization.
