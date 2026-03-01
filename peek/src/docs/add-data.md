# Add Data

Use the Add Data page to onboard Elastic Distribution of OpenTelemetry (EDOT) collectors for Kubernetes, Docker, and Hosts/VMs.

## Endpoint type

Before choosing a platform, select an endpoint type:

- **Elasticsearch** — send data directly to an Elasticsearch endpoint using an API key. The starter command includes `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` placeholders for your Elasticsearch URL and API key.
- **Managed OTLP** — send data to a managed OTLP ingest endpoint (e.g. Elastic Cloud). When selected, the page validates the derived OTLP URL and shows a status message indicating whether the endpoint is reachable. For Elastic Cloud the URL follows the pattern `https://<id>.ingest.<region>.<provider>.elastic.cloud`. The starter command is adjusted to target the OTLP endpoint instead of Elasticsearch directly.

The page links to official quickstart guides and provides starter commands whose placeholders vary by the selected endpoint type.

If your credentials have API key privileges, you can generate a collector key directly in-app. Otherwise, use the Elasticsearch Create API key API or ask an administrator to provision one.

Official references:

- https://www.elastic.co/docs/solutions/observability/get-started
- https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-create-api-key
