# Proxy Mode

Proxy mode routes all Elasticsearch API requests through a local server so your browser never makes cross-origin calls.

Start the dev server with: ES_URL=http://localhost:9200 make serve-proxy

Then enter http://localhost:3000/\_es as the Elasticsearch URL in the connection dialog. The /\_es prefix proxies all requests (connection validation, queries, cluster health, etc.) to the upstream Elasticsearch cluster.

The legacy /\_query proxy path also remains available for ES|QL queries only.

The Docker image also includes a built-in nginx proxy — set the ES_URL environment variable when running the container and enter http://localhost:8080/\_es as the Elasticsearch URL.
