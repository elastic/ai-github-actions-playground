# Proxy Mode

Proxy mode routes all Elasticsearch API requests through a local server so your browser never makes cross-origin calls.

Start the dev server with: ES_URL=http://localhost:9200 make serve-proxy

Then enter http://localhost:3000/\_es as the **Proxy URL** in the connection dialog.
You can optionally set **Proxy Host** and **Proxy API Key**; Peek sends these values as
`X-Elastic-Peek-Proxy-Host` and `X-Elastic-Peek-Proxy-Api-Key` headers on every request.
The /\_es prefix proxies all requests (connection validation, queries, cluster health, etc.)
to the upstream Elasticsearch cluster.

The Docker image also includes a built-in nginx proxy — set the ES_URL environment variable when running the container and enter http://localhost:8080/\_es as the Elasticsearch URL.

Use proxy mode when your Elasticsearch cluster cannot or should not expose browser CORS headers directly.

If requests fail in proxy mode, confirm the `ES_URL` target is reachable from the machine running Peek and that the upstream credentials have permission for the requested APIs.
