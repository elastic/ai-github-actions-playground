# Elastic Fleet in Peek

Elastic Fleet is the control plane for Elastic Agent: it manages agent enrollment, policies, upgrades, and action dispatch from Kibana.

Fleet control-plane state is stored in Elasticsearch `fleet-*` indices, while the data collected by agents lands in data streams such as `logs-*`, `metrics-*`, and `traces-*`.

Use Data Streams to inspect stream metadata and quickly spot `type`, `dataset`, and `namespace` naming parts used by Fleet integrations.

Use Fleet quick queries in Data Streams to open Query Lab with starter ES|QL for dataset distribution and unique shipper counts.

The default dashboard also includes Fleet-focused panels so you can quickly validate dataset and namespace coverage in recent telemetry.
