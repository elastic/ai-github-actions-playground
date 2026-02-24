# LLM Settings

Open Settings from the sidebar menu to configure the provider and model used by the Chat assistant.

Choose either OpenAI or OpenRouter, paste an API key, and select a model compatible with your provider choice.

## Custom model ID

By default, model selection uses a preset list. To use a model not in the list, enable the **Use custom model ID** toggle. This replaces the preset dropdown with a free-text **Model ID** field where you can type any model identifier supported by your chosen provider.

Provider-specific format examples:

- **OpenAI** — `gpt-4o`, `o3-mini`
- **OpenRouter** — `anthropic/claude-3.5-sonnet`

The Model ID field is required when the toggle is on; Chat will show a validation error if the field is left empty. Turning the toggle off restores the preset dropdown. If the model you had entered is not in the preset list, the selection automatically reverts to the first preset for that provider.

LLM credentials are stored in session storage only and are cleared when the browser session ends.

Use Reset LLM Settings when rotating credentials or switching environments to avoid stale configuration.

If Chat reports configuration errors, confirm provider/model alignment and ensure the API key has access to the selected model.
