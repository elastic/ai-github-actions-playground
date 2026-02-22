# Proxy Mode

Proxy mode routes all /\_query requests through a local server so your browser never makes cross-origin calls.

Start the dev server with: ES_URL=http://localhost:9200 make serve-proxy

Then enter http://localhost:3000 as the Elasticsearch URL in the connection dialog.

The Docker image also includes a built-in nginx proxy — just set the ES_URL environment variable when running the container.
