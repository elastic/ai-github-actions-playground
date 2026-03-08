# Fleet

Open Fleet from the sidebar under System to monitor and manage Elastic Agents enrolled in your Fleet Server.

## Overview tab

The Overview tab shows aggregate health across all enrolled agents:

- **Total agents** — count of all agents reporting to Fleet Server.
- **Healthy / Unhealthy / Offline** — breakdown by agent status.
- **Policy summary** — cards for each agent policy with enrolled agent counts and health distribution.

Click any policy card to filter the Agents tab to that policy.

## Agents tab

The Agents tab lists every enrolled agent with sortable columns:

- **Agent name** — hostname or custom name assigned to the agent.
- **Status** — current health state (Healthy, Unhealthy, Offline, Updating, Enrolling).
- **Policy** — the Fleet policy assigned to the agent.
- **Version** — installed agent version.
- **Last checkin** — timestamp of the most recent agent heartbeat.

Use the search box to filter agents by name, policy, or status keyword.

Click any agent row to open the **Agent Detail** page showing full agent metadata, assigned policy, enrolled integrations, and recent activity.

## Outputs tab

The Outputs tab shows configured Fleet output destinations — typically Elasticsearch clusters — along with their type and health status.

## Troubleshooting

If Fleet shows no agents, verify that:

1. Fleet Server is running and accessible from your agents.
2. Your Elasticsearch credentials have the `monitor` or `fleet-*` index privileges.
3. The `.fleet-agents*` index pattern exists and contains data.

If agent counts are stale, use the **Refresh** button to reload data from the cluster.
