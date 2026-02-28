# Ingest Pipelines

Open Ingest Pipelines from the sidebar to browse, inspect, and test ingest pipelines defined in your Elasticsearch cluster.

Search pipelines by name and select one to view its metadata — description, version, and processor count — along with the full processor chain as JSON.

## Simulating a pipeline

Use the Simulate section to test one or more documents against a pipeline without indexing real data. Paste your input into the field and click **Simulate**.

### Supported input formats

- **Single document** — a JSON object (`{"field": "value"}` or `{"_source": {"field": "value"}}`)
- **JSON array** — multiple documents in one array (`[{"field": "a"}, {"field": "b"}]`)
- **NDJSON** — one JSON object per line, useful for pasting log samples directly

The simulator accepts either a raw `_source` object or a full document wrapper with a `_source` key. Each input format can mix both styles.

### Results

Each document shows an **OK** or **Error** status chip alongside its index. For error documents the failing processor type and reason are displayed inline. Click **Expand** on any document to see the final transformed `_source` output.

### Verbose processor trace

Enable **Verbose trace** before clicking Simulate to request a per-processor breakdown from Elasticsearch. When enabled, expanding a document also reveals the Processor trace section, which lists every processor that ran with its individual status (success or error).

## Troubleshooting

If simulation returns an error, verify that the input is valid JSON and that the document structure matches what the pipeline processors expect.

For batch inputs, ensure every entry in the JSON array or NDJSON stream is a valid JSON object.

If pipelines fail to load, refresh the page and verify that your role has access to the `_ingest/pipeline` API.
