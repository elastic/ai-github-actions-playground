# Proxy Mode

Proxy mode routes all Elasticsearch API requests through a local server so your browser never makes cross-origin calls. This is the recommended approach when you cannot configure CORS headers on your cluster.

## Local development proxy

Start the dev server with:

```bash
ES_URL=http://localhost:9200 make serve-proxy
```

Then configure the connection in Peek:

1. Open the connection dialog (click the connection chip or gear icon).
2. Expand **Proxy Settings**.
3. Enter `http://localhost:3000/_es` as the **Proxy URL**.
4. Enter your Elasticsearch URL in the main URL field.

Peek automatically sends the Elasticsearch URL as `X-Elastic-Peek-Proxy-Host` on every request so the proxy knows which cluster to forward to. The `/_es` prefix proxies all requests (connection validation, queries, cluster health, etc.) to the upstream Elasticsearch cluster.

## Docker proxy

The Docker image includes a built-in nginx proxy. Set the `ES_URL` environment variable when running the container:

```bash
docker run -e ES_URL=http://your-cluster:9200 -p 8080:8080 elastic-peek
```

Then enter `http://localhost:8080/_es` as the Elasticsearch URL in the connection dialog.

## When to use proxy mode

- Your cluster is behind a firewall or VPN that does not allow browser CORS headers.
- You are using a managed Elasticsearch deployment where you cannot edit `elasticsearch.yml`.
- You want to avoid exposing CORS headers on a production cluster.

## Troubleshooting

If requests fail in proxy mode:

1. Confirm the `ES_URL` target is reachable from the machine running Peek.
2. Verify that the upstream credentials have permission for the requested APIs.
3. Check that the proxy server is running and listening on the expected port.
4. Look for network errors in the browser console for connection timeout or DNS resolution failures.
