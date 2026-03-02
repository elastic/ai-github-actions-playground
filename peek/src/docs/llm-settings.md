# LLM Settings

Open Settings from the sidebar menu to configure the provider and model used by the Chat assistant.

Choose either OpenAI or OpenRouter, paste an API key, and select a model compatible with your provider choice.

## Custom model ID

By default, model selection uses a preset list. To use a model not in the list, enable the **Use custom model ID** toggle. This replaces the preset dropdown with a free-text **Model ID** field where you can type any model identifier supported by your chosen provider.

Provider-specific format examples:

- **OpenAI** — `gpt-4o`, `o3-mini`
- **OpenRouter** — `anthropic/claude-3.5-sonnet`

The Model ID field is required when the toggle is on; Chat will show a validation error if the field is left empty. Turning the toggle off restores the preset dropdown. If the model you had entered is not in the preset list, the selection automatically reverts to the first preset for that provider.

## Elastic Docs search in chat

Enable the **Enable Elastic Docs search in chat** toggle to give the Chat assistant access to Elastic documentation search. When enabled, the assistant can look up Elasticsearch features, APIs, ES|QL syntax, and configuration details from the official Elastic documentation during a conversation.

This toggle is off by default. Enabling it adds a documentation search tool to the chat runtime that communicates with the Elastic Docs service. Disable it to restrict the assistant to cluster-local tools only.

The built-in tools (query execution, screen context, page navigation, query drafting, and time range control) are always available when a cluster is connected and do not require this toggle. See Chat for the full list of built-in tools.

LLM credentials are stored in session storage only and are cleared when the browser session ends.

Use Reset LLM Settings when rotating credentials or switching environments to avoid stale configuration.

If Chat reports configuration errors, confirm provider/model alignment and ensure the API key has access to the selected model.
