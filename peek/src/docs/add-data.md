# Add Data

Use the Add Data wizard to onboard telemetry sources in a three-step flow with experience-tile navigation and collapsible accordion sections.

## Step 1 — What are you monitoring?

Choose a technology using:

- **Experience tiles** — four primary tiles (Cloud Providers, Kubernetes, Servers/Desktops/Laptops, SaaS & Databases) plus an Advanced accordion
- **Search** — filter across all experiences by typing a technology name

Clicking an experience tile drills into that experience's technology list. Clicking a technology selects it and enables the Continue button.

Your selection drives the guide type, expected signals, and contextual guidance for later steps.

## Step 2 — Set up and verify

This step consolidates environment configuration, install commands, credentials, and ingestion verification into a single page. Configure and Install are collapsible accordion sections; Verification is inline (not collapsible):

### Configure section (guide-specific)

The section label and content vary by guide type:

- **EDOT Collector**: "Select your environment" — endpoint type toggle (Elasticsearch / Managed OTLP) and platform tabs (Kubernetes, Docker, Linux, macOS, Windows)
- **OTel Receiver**: "Configure receiver" — receiver-specific fields
- **APM**: "Select language" — APM language selection
- **AWS Cloud Deploy**: "Select AWS services" — deployment target selection
- **Fluent Bit**: "Configure output" — output mode selection

When Managed OTLP is selected, the wizard probes derived ingest endpoints and surfaces endpoint health inline.

### Install section (guide-specific)

The section label varies (e.g., "Install and configure", "Instrument your app", "Deploy stack", "Install Fluent Bit"). Contains:

- Progressive command step cards with per-step copy
- Copy-all support
- Official quickstart docs link
- Collector credentials — API key generation when permissions allow; otherwise show a no-permission warning alert (expected behavior) and guide manual credential provisioning

The command template pre-fills available endpoint/version/API key values.

### Verification panel

Inline (not collapsible) ingestion verification:

- Automatic polling (auto-starts after valid credentials are available)
- **Check now** for manual trigger
- Per-signal verification cards showing data stream and host/agent detection

Validation messaging is contextual to the selected technology's expected signals and supports partial success guidance.

## Step 3 — Explore your data + next steps

Success outcomes include contextual CTAs:

- Open signal page (Metrics, Traces, Query Lab)
- Open Dashboards
- Set up alerting
- Add another source

"Add another source" resets the wizard back to Step 1 with experience tiles.

## References

- https://www.elastic.co/docs/solutions/observability/get-started
- https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-create-api-key
