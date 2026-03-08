# Hosts

Open Hosts from the sidebar under Data to explore host-level system metrics collected by Elastic Agent, Metricbeat, or OpenTelemetry.

## Host categories

The Hosts section provides platform-specific views:

- **Linux Hosts** — system metrics from Linux servers and VMs.
- **Windows Hosts** — system metrics from Windows machines.
- **macOS Hosts** — system metrics from macOS desktops and laptops.

Each category filters host data to the relevant operating system.

## Host list

The host list shows key metrics for each host:

- **Hostname** — the reported host name.
- **CPU %** — current CPU utilization.
- **Memory %** — current memory usage.
- **Disk usage** — storage utilization.
- **Network I/O** — inbound and outbound traffic.
- **Uptime** — time since last boot.

Use the search box to filter hosts by name.

## Host detail

Click any host row to open the detail view:

- **System overview** — OS info, uptime, CPU, memory, and disk summary.
- **CPU metrics** — per-core utilization, load averages, and process counts.
- **Memory** — used, free, cached, and swap usage over time.
- **Disk** — per-volume read/write throughput and utilization.
- **Network** — per-interface traffic rates and error counts.
- **Processes** — top processes by CPU and memory usage.

## Troubleshooting

If no hosts appear:

1. Verify that `metrics-system.*` or equivalent data streams exist.
2. Check that the time range covers periods with host metric data.
3. Confirm your credentials have read access to the system metric indices.

Use **Open in Query Lab** to explore host metrics with full ES|QL control.
