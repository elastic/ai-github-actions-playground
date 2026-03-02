# Add Data

Use the Add Data page to onboard Elastic Distribution of OpenTelemetry (EDOT) collectors for Kubernetes, Docker, and Hosts/VMs.

## Endpoint type

Before choosing a platform, select an endpoint type:

- **Elasticsearch** — send data directly to an Elasticsearch endpoint using an API key. The starter command includes `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` placeholders for your Elasticsearch URL and API key.
- **Managed OTLP** — send data to a managed OTLP ingest endpoint (e.g. Elastic Cloud). When selected, the page validates the derived OTLP URL and shows a status message indicating whether the endpoint is reachable. Supported auto-derivation patterns include `.elastic.cloud`, `.cloud.es.io`, and `.kb.*.cloud.es.io` URLs. For `.cloud.es.io`, the wizard probes both `.cloud.es.io` and `.elastic-cloud.com` ingest hosts and uses the first reachable endpoint in the starter command.

The page links to official quickstart guides and provides starter commands whose placeholders vary by the selected endpoint type.

If your credentials have API key privileges, you can generate a collector key directly in-app. Otherwise, use the Elasticsearch Create API key API or ask an administrator to provision one.

## Verify ingestion

After starting the collector, click **Check now** to verify whether telemetry data streams have appeared in Elasticsearch. Verification also starts automatically once an API key is generated or a starter command is copied.

Once initiated, verification continues polling automatically in the background — you do not need to click again. A pulsing "Listening for data…" indicator confirms that auto-polling is active.

Possible outcomes:

- **found** — telemetry data was detected. The alert lists the signal types found (e.g. logs, metrics, traces) and provides navigation buttons to jump directly to the corresponding page for each signal.
- **not_found** — no telemetry data streams found yet. Make sure the collector is running — the page will keep checking automatically. A link to the OpenTelemetry troubleshooting docs is provided.
- **error** — the verification request failed. Check your connection and permissions, then retry.

Official references:

- https://www.elastic.co/docs/solutions/observability/get-started
- https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-create-api-key
