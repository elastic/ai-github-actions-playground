# API Keys

Open API Keys from the sidebar under System to browse and inspect Elasticsearch API keys without writing API calls manually.

The page lists all API keys visible to your credentials, sorted by name. Use the search box to filter keys by name or owner username.

Select a key to view its details:

- **Owner** — the username that owns the key, shown as a clickable chip that navigates to the Users page filtered to that user.
- **ID** — the unique key identifier.
- **Created** — creation timestamp and age.
- **Expires** — expiration timestamp, or "Never" if the key has no expiration.
- **Realm** — the authentication realm, if present.
- **Metadata** — the key's metadata object displayed as formatted JSON.

## Risk assessment

Each key shows a risk chip based on its age, expiration, and other factors. This helps identify keys that may need rotation or review.

## Actions

Click **Refresh** to reload the key list from the cluster.

Click **Copy API call** to copy `GET /_security/api_key` to your clipboard for use in the API Console or any HTTP client.

If your credentials lack API key read permissions, a warning message explains that access is denied. Contact an administrator to grant the `manage_api_key` or `manage_own_api_key` cluster privilege.
