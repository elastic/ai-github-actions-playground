# Investigate

Open Investigate from the sidebar under Security to search for entities — users, hosts, IP addresses, domains, or files — and view their recent security event timeline.

## Getting started

1. Enter a search term in the query bar (e.g., a username, hostname, or IP address).
2. Click **Search** to query security event indices for matching entities.
3. Browse the resulting timeline of events associated with the entity.

## Tabs

- **Timeline** — chronological list of security events for the searched entity, showing event type, timestamp, source, and key fields.
- **Summary** — AI-generated summary of the entity's recent activity, highlighting patterns and anomalies. Requires an LLM provider configured in Settings.
- **Suggestions** — AI-powered investigation suggestions based on the timeline data, recommending next steps and related queries.

## Event timeline

The timeline table shows events with sortable columns including timestamp, event action, source index, and key event fields. Click any event row to expand its full document.

Use the time picker in the app header to control the investigation window.

## AI-powered analysis

When an LLM provider is configured, Investigate provides:

- **Auto-summary** of the entity's event patterns and risk signals.
- **Investigation suggestions** with specific ES|QL queries to run for deeper analysis.
- **Context-aware prompts** that incorporate the current timeline data.

## Troubleshooting

If no events appear:

1. Verify that security event indices exist (e.g., `logs-*`, `.ds-logs-*`).
2. Check that the time range covers periods with security events.
3. Confirm your search term matches fields in the security event documents.
