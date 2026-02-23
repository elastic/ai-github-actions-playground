# About Elastic Peek

Elastic Peek is part of an AI Software Engineering Factory proof of concept built on elastic/ai-github-actions. AI-powered workflows autonomously triage issues, review pull requests, and iterate on this codebase.

The app itself is a lightweight, browser-based Elasticsearch dashboard builder created entirely by AI agents.

There is no backend server — your browser talks to Elasticsearch via the `_query` REST API. Credentials never leave your machine.

You can also run a local proxy to avoid configuring CORS on your cluster.
