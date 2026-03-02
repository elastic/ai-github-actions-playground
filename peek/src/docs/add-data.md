# Add Data

Use the Add Data wizard to onboard Elastic Distribution of OpenTelemetry (EDOT) in an explicit five-step flow.

## Step 1 — What are you monitoring?

Choose a technology from:

- **Search** (find technologies quickly)
- **Category filters** (Cloud, Containers, Databases, Applications, Operating Systems, Network)
- **Recommended for you** shortcuts

Your selection drives the expected signals and contextual guidance for later steps.

## Step 2 — Select your environment

Reuse the existing environment controls:

- **Endpoint type**: Elasticsearch or Managed OTLP
- **Platform**: Kubernetes, Docker, Linux, macOS, Windows

When Managed OTLP is selected, the wizard probes derived ingest endpoints and surfaces endpoint health inline.

## Step 3 — Install and configure

Generate tailored install commands with:

- Progressive command step cards with per-step copy
- Copy-all support
- Official quickstart docs link
- API key generation and copy workflow (when permissions allow)

The command template pre-fills available endpoint/version/API key values.

## Step 4 — Validate data receipt

Verification keeps the existing ingestion primitives:

- `runVerifyOnce` for one-shot checks
- `startPolling` for automatic polling
- **Check now** for manual trigger

Validation messaging is contextual to the selected technology’s expected signals and supports partial success guidance.

## Step 5 — Explore your data + next steps

Success outcomes now include contextual CTAs beyond signal-only routes:

- Open signal page (Metrics, Traces, Query Lab)
- Open Dashboards
- Set up alerting
- Add another source

This provides a direct “aha moment” and clear follow-up actions after setup.

## References

- https://www.elastic.co/docs/solutions/observability/get-started
- https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-create-api-key
