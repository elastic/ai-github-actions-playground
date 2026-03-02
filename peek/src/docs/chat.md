# Chat

Chat provides an in-app assistant for ES|QL writing help, dashboard guidance, and exploratory analysis prompts.

Before first use, configure an LLM provider and API key in LLM Settings.

Messages are stored in browser session state for the current tab so you can iterate on a query conversation without leaving Peek.

Use short, specific prompts such as your index name, expected output, and constraints to get actionable responses faster.

## Explain Mode

Click the crosshair icon in the AI Assistant header to activate Explain Mode. While active, click any element in the app and Chat will automatically receive an "Explain this element" prompt with context about the clicked element — including its role, text content, and surrounding headings. Explain Mode is single-shot: it deactivates after one click. You can also cancel it by clicking the crosshair icon again or closing the drawer.

## Built-in Chat tools

Chat has the following built-in tools available by default whenever an Elasticsearch connection is active:

**run\_esql\_query** — Run an ES|QL query against the active Elasticsearch connection and return bounded results. Queries are subject to enforced timeouts and truncated result payloads before data is returned to the model.

**get\_screen\_context** — Get a snapshot of what the user currently sees, including the current page, panels, queries, time range, filters, and visible data summaries. The assistant uses this to give context-aware answers.

**navigate\_to\_page** — Navigate to a page in the Elastic Peek app. Use this when asking the assistant to go to a specific page such as Metrics, Traces, or Query Lab.

**set\_query\_lab\_query** — Set an ES|QL query in the Query Lab editor. This sets the draft query but does not execute it — the user can review and run it manually. The assistant also navigates to the Query Lab page after setting the query.

**set\_time\_range** — Set the active time range on the current dashboard using date-math expressions (e.g. `now-15m`, `now-1h`, `now`).

## Elastic Docs search

When **Enable Elastic Docs search in chat** is turned on in LLM Settings, the assistant can also search the official Elastic documentation to answer questions about Elasticsearch features, APIs, ES|QL syntax, and configuration. This tool has a 30-second timeout and a per-query step limit. Disable the toggle in Settings to restrict the assistant to cluster-local tools only.

If responses fail or time out, confirm provider settings, API key validity, and outbound network access to the selected model endpoint.
