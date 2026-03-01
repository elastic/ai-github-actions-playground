# Add Data

Use the Add Data page to onboard Elastic Distribution of OpenTelemetry (EDOT) collectors for Kubernetes, Docker, and Hosts/VMs.

## Endpoint type

Before choosing a platform, select an endpoint type:

- **Elasticsearch** — send data directly to an Elasticsearch endpoint using an API key. The starter command includes `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` placeholders for your Elasticsearch URL and API key.
- **Managed OTLP** — send data to a managed OTLP ingest endpoint (e.g. Elastic Cloud). When selected, the page validates the derived OTLP URL and shows a status message indicating whether the endpoint is reachable. For Elastic Cloud the URL follows the pattern `https://<id>.ingest.<region>.<provider>.elastic.cloud`. The starter command is adjusted to target the OTLP endpoint instead of Elasticsearch directly.

The page links to official quickstart guides and provides starter commands whose placeholders vary by the selected endpoint type.

If your credentials have API key privileges, you can generate a collector key directly in-app. Otherwise, use the Elasticsearch Create API key API or ask an administrator to provision one.

## Verify ingestion

After starting the collector, click **Verify ingestion** to check whether telemetry data streams have appeared in Elasticsearch:

- **found** — telemetry data was detected. The alert lists the signal types found (e.g. logs, metrics, traces) and provides navigation buttons to jump directly to the corresponding page for each signal.
- **not_found** — no telemetry data streams were found yet. Make sure the collector is running and try again in a few moments. A link to the OpenTelemetry troubleshooting docs is provided.
- **error** — the verification request failed. Check your connection and permissions, then retry.

Official references:

- https://www.elastic.co/docs/solutions/observability/get-started
- https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-create-api-key
