# Chat

Chat provides an in-app assistant for ES|QL writing help, dashboard guidance, and exploratory analysis prompts.

Before first use, configure an LLM provider and API key in LLM Settings.

Messages are stored in browser session state for the current tab so you can iterate on a query conversation without leaving Peek.

Use short, specific prompts such as your index name, expected output, and constraints to get actionable responses faster.

Chat can run bounded ES|QL execution through an internal `run_esql_query` tool, with enforced timeouts and truncated result payloads before returning data to the model.

When **Enable Elastic Docs search in chat** is turned on in LLM Settings, the assistant can also search the official Elastic documentation to answer questions about Elasticsearch features, APIs, ES|QL syntax, and configuration. This tool has a 30-second timeout and a per-query step limit. Disable the toggle in Settings to restrict the assistant to cluster-local tools only.

If responses fail or time out, confirm provider settings, API key validity, and outbound network access to the selected model endpoint.
