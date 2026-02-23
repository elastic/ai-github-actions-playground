# About Elastic Peek

Elastic Peek is part of an AI Software Engineering Factory proof of concept built on elastic/ai-github-actions. AI-powered workflows autonomously triage issues, review pull requests, and iterate on this codebase.

The app itself is a lightweight, browser-based Elasticsearch dashboard builder created entirely by AI agents.

There is no backend server — your browser talks to Elasticsearch via the `_query` REST API. Credentials never leave your machine.

You can also run a local proxy to avoid configuring CORS on your cluster.

## Copilot PAT setup for workflow automation

If you use the AI GitHub Actions workflows, add a repository secret named `COPILOT_GITHUB_TOKEN` backed by a GitHub Personal Access Token (PAT) that has access to the repository features your workflows need.

This is the same for public and private repositories; for private repos, ensure the PAT is authorized for that private repository or organization.
