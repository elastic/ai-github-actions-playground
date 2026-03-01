# CORS Configuration

Since the app queries Elasticsearch directly from your browser, your cluster must allow cross-origin requests.

Add http.cors.enabled: true and set http.cors.allow-origin to your dashboard URL in elasticsearch.yml.

For local development you can use allow-origin: "\*", but never use the wildcard in production.

Alternatively, use proxy mode to skip CORS entirely — see the Proxy Mode documentation.
