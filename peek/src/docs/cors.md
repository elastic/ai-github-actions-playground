# CORS Configuration

Since the app queries Elasticsearch directly from your browser, your cluster must allow cross-origin requests (CORS). Without CORS headers, browsers block the responses and Peek cannot communicate with the cluster.

## Required settings

Add the following to your `elasticsearch.yml`:

```yaml
http.cors.enabled: true
http.cors.allow-origin: "https://your-peek-url.example.com"
http.cors.allow-headers: "X-Requested-With, Content-Type, Authorization, X-Elastic-Peek-Proxy-Host"
http.cors.allow-credentials: true
```

Replace the `allow-origin` value with the exact URL where Peek is hosted. For local development you can use `"*"` as a wildcard, but **never use the wildcard in production** — it allows any website to send requests to your cluster.

After changing `elasticsearch.yml`, restart the Elasticsearch node for the settings to take effect.

## Common issues

- **Mixed content errors** — if Peek is served over HTTPS but your cluster uses HTTP, most browsers block the request. Either serve Peek over HTTP during development or configure TLS on your cluster.
- **Preflight failures** — missing `allow-headers` can cause OPTIONS preflight requests to fail. Ensure the `Authorization` and `Content-Type` headers are listed.
- **Multiple origins** — `http.cors.allow-origin` accepts a single origin or a regex. To allow multiple specific origins, use a regex pattern like `/https?:\/\/(localhost|peek\.example\.com)(:[0-9]+)?/`.

## Alternative: Proxy Mode

If configuring CORS is not feasible (e.g., managed Elasticsearch deployments where you cannot edit `elasticsearch.yml`), use Proxy Mode instead. The local proxy routes all requests through a same-origin server, avoiding CORS entirely.
