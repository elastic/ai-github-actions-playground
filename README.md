# ES|QL Dashboard

A lightweight, static dashboarding tool powered by [Perses](https://perses.dev/) components and Elasticsearch [ES|QL](https://www.elastic.co/guide/en/elasticsearch/reference/current/esql.html).

## Live Demo

https://elastic.github.io/ai-github-actions-playground/

## Overview

ES|QL Dashboard is a browser-based dashboard builder that connects directly to your Elasticsearch cluster. No backend server required — the static site queries Elasticsearch using ES|QL via the `_query` REST API.

- **Direct browser-to-Elasticsearch** — no proxy, no middleware
- **ES|QL query editor** — write queries with syntax highlighting
- **Multiple visualization types** — time series, bar charts, pie charts, tables, stats, gauges
- **Drag-and-drop layout** — resize and rearrange panels freely
- **Persistent state** — dashboards save to localStorage automatically
- **Import/export** — share dashboards as JSON files
- **Dark and light themes**

## Quick Start

```bash
make setup   # install dependencies
make serve   # start dev server at http://localhost:3000
```

Or manually:

```bash
cd dashboard
npm install
npm run dev
```

## Prerequisites

- **Node.js** ≥ 18
- An **Elasticsearch** cluster with:
  - [CORS configured](https://www.elastic.co/guide/en/elasticsearch/reference/current/modules-network.html) to allow browser requests (see below)
  - An [API key](https://www.elastic.co/guide/en/elasticsearch/reference/current/security-api-create-api-key.html) with read permissions

### Generating an API Key

#### Via Kibana

1. Open Kibana and go to **Stack Management → Security → API keys**
2. Click **Create API key**
3. Give it a name (e.g. `esql-dashboard`)
4. Under **Control security privileges**, restrict it to the indices you want to query:
   ```json
   {
     "indices": [
       {
         "names": ["logs-*", "metrics-*"],
         "privileges": ["read"]
       }
     ]
   }
   ```
   Replace `logs-*`, `metrics-*` with the specific index patterns you need. Avoid granting access to `*` (all indices) unless necessary.
5. Click **Create API key** and copy the generated key — it is only shown once

#### Via the Elasticsearch REST API

```bash
curl -X POST "https://<your-elasticsearch-url>/_security/api_key" \
  -H "Content-Type: application/json" \
  -u "<username>:<password>" \
  -d '{
    "name": "esql-dashboard",
    "role_descriptors": {
      "esql_read": {
        "indices": [
          {
            "names": ["logs-*", "metrics-*"],
            "privileges": ["read"]
          }
        ]
      }
    }
  }'
```

> **Note:** Use a dedicated user with limited permissions to create the API key rather than admin credentials. To avoid exposing credentials in your shell history, set them as environment variables: `ES_USER` and `ES_PASS`, then use `-u "$ES_USER:$ES_PASS"`.

The response contains an `encoded` field — use that value as your API key in the dashboard connection dialog.

### Elasticsearch CORS Configuration

Since the dashboard queries Elasticsearch directly from your browser, your cluster must have CORS enabled. Add the following to your `elasticsearch.yml`:

```yaml
http.cors.enabled: true
http.cors.allow-origin: "https://<your-dashboard-domain>"
http.cors.allow-headers: "Authorization,Content-Type"
```

> **⚠️ Security warning:** Do **not** use `http.cors.allow-origin: "*"` in production — it allows any website to send requests to your cluster using a visitor's credentials. Only use the wildcard value for local development:
>
> ```yaml
> # Local development only — do not use in production
> http.cors.allow-origin: "*"
> ```

## Connecting

1. Open the dashboard in your browser
2. Click **Connect to Elasticsearch**
3. Enter your Elasticsearch URL and API key
4. Click **Connect**

The connection is made directly from your browser. No credentials are sent to any intermediary server.

## Using a Local Elasticsearch

You can connect the dashboard to a local Elasticsearch instance (e.g. `http://localhost:9200`).

### CORS Configuration

Elasticsearch must have CORS enabled to accept requests from the dashboard's origin. Add the following to your `elasticsearch.yml`:

```yaml
http.cors.enabled: true
http.cors.allow-origin: "https://elastic.github.io"
http.cors.allow-headers: "Authorization, Content-Type, X-Elastic-Client-Meta"
```

If running the dev server locally, also allow `http://localhost:3000`.

### Browser Private Network Access Prompt

When the dashboard is served over HTTPS (e.g. the live demo at `https://elastic.github.io`) and you connect to a local Elasticsearch at `http://localhost`, your browser may display a **Private Network Access** permission prompt. This is a security feature in Chromium-based browsers that restricts public websites from making requests to your local network.

If you see this prompt, click **Allow** to permit the connection. If no prompt appears and the connection is blocked, check `chrome://flags/#private-network-access-respect-preflight-results` or try using the dashboard from the local dev server (`http://localhost:3000`) instead, which avoids the HTTPS-to-HTTP restriction.

## Technology

| Component | Technology |
| --- | --- |
| Charts | [Apache ECharts](https://echarts.apache.org/) via [Perses](https://perses.dev/) component patterns |
| UI framework | [MUI](https://mui.com/) (same as Perses) |
| Frontend | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Build | [Vite](https://vite.dev/) |
| State | [Zustand](https://zustand.docs.pmnd.rs/) |
| Query editor | [CodeMirror](https://codemirror.net/) |
| Layout | [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) |

## Further Reading

- [Development guide](DEVELOPING.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT
