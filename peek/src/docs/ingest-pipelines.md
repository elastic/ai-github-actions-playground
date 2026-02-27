# Ingest Pipelines

Open Ingest Pipelines from the sidebar to browse, inspect, and test ingest pipelines defined in your Elasticsearch cluster.

Search pipelines by name and select one to view its metadata — description, version, and processor count — along with the full processor chain as JSON.

## Simulating a pipeline

Use the Simulate section to test a pipeline against a sample document without indexing real data. Paste a JSON document into the input field and click **Simulate**.

The simulator accepts either a raw `_source` object or a full document wrapper with a `_source` key. The result shows the transformed document exactly as Elasticsearch would produce it after all processors run.

## Troubleshooting

If simulation returns an error, verify that the input is valid JSON and that the document structure matches what the pipeline processors expect.

If pipelines fail to load, refresh the page and verify that your role has access to the `_ingest/pipeline` API.
